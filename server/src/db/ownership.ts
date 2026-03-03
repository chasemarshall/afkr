import { config } from '../config/env.js';

/**
 * Check if a userId corresponds to the configured admin user.
 * Only returns true when admin API key fallback is enabled and the userId
 * matches the configured ADMIN_FALLBACK_USER_ID exactly.
 */
export function isAdminUserId(userId: string): boolean {
  if (!config.ALLOW_ADMIN_API_KEY_FALLBACK) return false;
  if (!config.ADMIN_FALLBACK_USER_ID) return false;
  return userId === config.ADMIN_FALLBACK_USER_ID;
}

export function applyOwnerFilter(query: any, userId: string): any {
  if (isAdminUserId(userId)) {
    return query;
  }
  return query.eq('owner_user_id', userId);
}
