export function isAdminUserId(userId: string): boolean {
  void userId;
  return false;
}

export function applyOwnerFilter(query: any, userId: string): any {
  return query.eq('owner_user_id', userId);
}
