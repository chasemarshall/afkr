import { Authflow, Titles } from 'prismarine-auth';
import pino from 'pino';
import { updateAccount, getAccountById } from '../db/accounts.js';

const logger = pino({ name: 'AuthService' });

class AuthService {
  async authenticateAccount(
    accountId: string,
    userId: string,
    onDeviceCode: (userCode: string, verificationUri: string) => void
  ): Promise<string> {
    const account = await getAccountById(accountId, userId);
    if (!account) throw new Error(`Account ${accountId} not found`);

    return new Promise<string>((resolve, reject) => {
      try {
        const tokenCache: Record<string, unknown> = account.auth_token_cache
          ? JSON.parse(account.auth_token_cache)
          : {};

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

        const flow = new Authflow(
          account.microsoft_email,
          cacheFactory,
          {
            authTitle: Titles.MinecraftJava,
            flow: 'live',
            deviceType: 'Win32',
          },
          (code) => {
            logger.info({ accountId }, 'Device code generated');
            onDeviceCode(code.user_code, code.verification_uri);
          }
        );

        flow
          .getMinecraftJavaToken()
          .then(async () => {
            // Store the token cache
            try {
               await updateAccount(accountId, {
                 auth_token_cache: JSON.stringify(tokenCache),
               }, userId);
            } catch (err) {
              logger.error({ accountId, error: (err as Error).message }, 'Failed to store token cache');
            }

            logger.info({ accountId }, 'Authentication complete');
            resolve(account.username);
          })
          .catch((err) => {
            logger.error({ accountId, error: (err as Error).message }, 'Authentication failed');
            reject(err);
          });
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const authService = new AuthService();
