import pino from 'pino';
import { getAccountWithTokenCache } from '../db/accounts.js';
import { createAuthflowForAccount } from './MinecraftAuth.js';

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

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          logger.error({ accountId }, 'Authentication timed out after 10 minutes');
          reject(new Error('Authentication timed out'));
        }
      }, AUTH_TIMEOUT_MS);

      createAuthflowForAccount(accountId, userId, onDeviceCode)
        .then(({ flow }) => flow.getMinecraftJavaToken({ fetchProfile: true }))
        .then(({ token, profile }) => {
          if (settled) return;
          clearTimeout(timeout);
          settled = true;
          logger.info({ accountId, hasToken: !!token }, 'Authentication complete');
          resolve(profile?.name || account.username);
        })
        .catch((err) => {
          if (settled) return;
          clearTimeout(timeout);
          settled = true;
          logger.error({ accountId, error: (err as Error).message }, 'Authentication failed');
          reject(err);
        });
    });
  }
}

export const authService = new AuthService();
