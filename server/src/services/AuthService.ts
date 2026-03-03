import prismarineAuth from 'prismarine-auth';
const { Authflow, Titles } = prismarineAuth;
import pino from 'pino';
import { config } from '../config/env.js';
import { updateAccount, getAccountWithTokenCache } from '../db/accounts.js';

const logger = pino({
  name: 'AuthService',
  redact: ['token', 'auth_token_cache', 'accessToken', 'refreshToken', 'password'],
});

// 10 minute timeout for device code flow (Microsoft codes expire after 15 min)
const AUTH_TIMEOUT_MS = 10 * 60 * 1000;

class AuthService {
  async authenticateAccount(
    accountId: string,
    userId: string,
    onDeviceCode: (userCode: string, verificationUri: string) => void
  ): Promise<string> {
    logger.info({ accountId }, 'Starting authentication flow');

    const account = await getAccountWithTokenCache(accountId, userId);
    if (!account) throw new Error('Account not found');

    return new Promise<string>((resolve, reject) => {
      let settled = false;

      // Timeout: reject if auth takes too long (device code expired, etc.)
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          logger.error({ accountId }, 'Authentication timed out after 10 minutes');
          reject(new Error('Authentication timed out'));
        }
      }, AUTH_TIMEOUT_MS);

      try {
        const tokenCache: Record<string, unknown> = account.auth_token_cache
          ? JSON.parse(account.auth_token_cache)
          : {};

        logger.info({ accountId, hasCachedTokens: Object.keys(tokenCache).length > 0 }, 'Token cache state');

        const cacheFactory = ({ cacheName }: { cacheName: string }) => ({
          async getCached(): Promise<unknown> {
            const existing = tokenCache[cacheName];
            if (typeof existing === 'object' && existing !== null) {
              return existing;
            }
            return {};
          },
          async reset(): Promise<void> {
            tokenCache[cacheName] = {};
          },
          async setCached(value: unknown): Promise<void> {
            tokenCache[cacheName] = value;
          },
          async setCachedPartial(value: Record<string, unknown>): Promise<void> {
            const existing = tokenCache[cacheName];
            const base = typeof existing === 'object' && existing !== null
              ? (existing as Record<string, unknown>)
              : {};
            tokenCache[cacheName] = {
              ...base,
              ...value,
            };
          },
        });

        logger.info({ accountId, email: account.microsoft_email }, 'Creating Authflow');

        // Use MSAL flow with Azure AD app for reliable device code auth.
        // The AZURE_CLIENT_ID env var should be set to your registered Azure app's client ID.
        // Falls back to prismarine-auth's built-in default if not set.
        const azureClientId = config.AZURE_CLIENT_ID;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const authOptions: any = { flow: 'msal' };
        if (azureClientId) {
          authOptions.authTitle = azureClientId;
        }

        logger.info({ accountId, flow: 'msal', hasCustomClientId: !!azureClientId }, 'Auth flow config');

        const flow = new Authflow(
          account.microsoft_email,
          cacheFactory,
          authOptions,
          (code) => {
            // MSAL flow returns camelCase (userCode, verificationUri)
            // Live flow returns snake_case (user_code, verification_uri)
            const userCode = code.userCode || code.user_code;
            const verificationUri = code.verificationUri || code.verification_uri;
            logger.info({ accountId, userCode, verificationUri }, 'Device code generated');
            onDeviceCode(userCode, verificationUri);
          }
        );

        logger.info({ accountId }, 'Calling getMinecraftJavaToken...');

        flow
          .getMinecraftJavaToken()
          .then(async (token) => {
            if (settled) return;
            clearTimeout(timeout);

            logger.info({ accountId, hasToken: !!token }, 'getMinecraftJavaToken resolved');

            // Store the token cache
            try {
               await updateAccount(accountId, {
                 auth_token_cache: JSON.stringify(tokenCache),
               }, userId);
               logger.info({ accountId }, 'Token cache stored in database');
            } catch (err) {
              logger.error({ accountId, error: (err as Error).message }, 'Failed to store token cache');
            }

            settled = true;
            logger.info({ accountId }, 'Authentication complete');
            resolve(account.username);
          })
          .catch((err) => {
            if (settled) return;
            clearTimeout(timeout);
            settled = true;
            logger.error({ accountId, error: (err as Error).message }, 'getMinecraftJavaToken failed');
            reject(err);
          });
      } catch (err) {
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          logger.error({ accountId, error: (err as Error).message }, 'Authflow construction failed');
          reject(err);
        }
      }
    });
  }
}

export const authService = new AuthService();
