import prismarineAuth from 'prismarine-auth';
const { Authflow, Titles } = prismarineAuth;
import type { CacheFactory } from 'prismarine-auth';
import { getAccountWithTokenCache, updateAccount } from '../db/accounts.js';
import { config } from '../config/env.js';

type TokenCacheState = Record<string, unknown>;

function getAuthOptions() {
  const azureClientId = config.AZURE_CLIENT_ID;
  return azureClientId
    ? { flow: 'msal' as const, authTitle: azureClientId as never }
    : { flow: 'sisu' as const, authTitle: Titles.MinecraftJava, deviceType: 'Win32' };
}

async function loadTokenCache(accountId: string, userId: string): Promise<{
  microsoftEmail: string;
  username: string;
  tokenCache: TokenCacheState;
}> {
  const account = await getAccountWithTokenCache(accountId, userId);
  if (!account) {
    throw new Error('Account not found');
  }

  let tokenCache: TokenCacheState = {};
  if (account.auth_token_cache) {
    try {
      tokenCache = JSON.parse(account.auth_token_cache) as TokenCacheState;
    } catch {
      tokenCache = {};
    }
  }

  return {
    microsoftEmail: account.microsoft_email,
    username: account.username,
    tokenCache,
  };
}

async function persistTokenCache(accountId: string, userId: string, tokenCache: TokenCacheState): Promise<void> {
  await updateAccount(accountId, {
    auth_token_cache: JSON.stringify(tokenCache),
  }, userId);
}

async function buildCacheFactory(
  accountId: string,
  userId: string
): Promise<{
  microsoftEmail: string;
  username: string;
  cacheFactory: CacheFactory;
}> {
  const { microsoftEmail, username, tokenCache } = await loadTokenCache(accountId, userId);
  let persistQueue = Promise.resolve();

  const queuePersist = async () => {
    persistQueue = persistQueue.then(() => persistTokenCache(accountId, userId, tokenCache));
    await persistQueue;
  };

  const cacheFactory: CacheFactory = ({ cacheName }) => ({
    async getCached(): Promise<unknown> {
      const existing = tokenCache[cacheName];
      if (typeof existing === 'object' && existing !== null) {
        return existing;
      }
      return {};
    },
    async reset(): Promise<void> {
      tokenCache[cacheName] = {};
      await queuePersist();
    },
    async setCached(value: unknown): Promise<void> {
      tokenCache[cacheName] = value;
      await queuePersist();
    },
    async setCachedPartial(value: Record<string, unknown>): Promise<void> {
      const existing = tokenCache[cacheName];
      const base = typeof existing === 'object' && existing !== null
        ? existing as Record<string, unknown>
        : {};
      tokenCache[cacheName] = {
        ...base,
        ...value,
      };
      await queuePersist();
    },
  });

  return {
    microsoftEmail,
    username,
    cacheFactory,
  };
}

export async function createAuthflowForAccount(
  accountId: string,
  userId: string,
  onDeviceCode?: (userCode: string, verificationUri: string) => void
) {
  const { microsoftEmail, username, cacheFactory } = await buildCacheFactory(accountId, userId);
  const flow = new Authflow(
    microsoftEmail,
    cacheFactory,
    getAuthOptions(),
    onDeviceCode
      ? (code) => {
        const raw = code as typeof code & {
          userCode?: string;
          verificationUri?: string;
        };
        const userCode = raw.userCode || code.user_code;
        const verificationUri = raw.verificationUri || code.verification_uri;
        onDeviceCode(userCode, verificationUri);
      }
      : undefined
  );

  return {
    flow,
    microsoftEmail,
    username,
  };
}

export async function authenticateMinecraftClient(
  accountId: string,
  userId: string,
  client: Record<string, unknown>,
  options: Record<string, unknown>
): Promise<void> {
  const { flow } = await createAuthflowForAccount(accountId, userId);
  const disableChatSigning = options.disableChatSigning === true;
  const { token, profile, certificates } = await flow.getMinecraftJavaToken({
    fetchProfile: true,
    fetchCertificates: !disableChatSigning,
  });

  if (!profile || (profile as { error?: unknown }).error) {
    throw new Error('Failed to obtain Minecraft profile data');
  }

  Object.assign(client, certificates);
  Object.assign(client, {
    session: {
      accessToken: token,
      selectedProfile: profile,
      availableProfile: [profile],
    },
    username: profile.name,
  });

  Object.assign(options, {
    accessToken: token,
    haveCredentials: token !== null,
  });

  const emit = client.emit;
  if (typeof emit === 'function') {
    emit.call(client, 'session', client.session);
  }

  const connect = options.connect;
  if (typeof connect !== 'function') {
    throw new Error('Minecraft protocol connect callback is missing');
  }
  connect(client);

  // Keep the stored username aligned with the actual Minecraft profile name.
  await updateAccount(accountId, { username: profile.name }, userId);
}
