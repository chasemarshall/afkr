export const ADMIN_USER_ID = 'admin';

export function isAdminUserId(userId: string): boolean {
  return userId === ADMIN_USER_ID;
}

export function applyOwnerFilter(query: any, userId: string): any {
  if (isAdminUserId(userId)) {
    return query;
  }
  return query.eq('owner_user_id', userId);
}
