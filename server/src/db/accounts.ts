import { supabase } from '../config/supabase.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { applyOwnerFilter } from './ownership.js';
import type { Account, CreateAccountPayload } from '@afkr/shared';

// Columns to select — never expose auth_token_cache to API consumers
const PUBLIC_COLUMNS = 'id, owner_user_id, username, microsoft_email, auto_reconnect, reconnect_delay_ms, max_reconnect_attempts, created_at, updated_at';

export async function getAllAccounts(userId: string): Promise<Account[]> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('accounts')
    .select(PUBLIC_COLUMNS)
    .order('created_at', { ascending: false }),
    userId
  );

  const { data, error } = await scopedQuery;

  if (error) throw error;
  return data as Account[];
}

/**
 * Get account by ID — returns PUBLIC fields only (no auth_token_cache).
 * Use getAccountWithTokenCache() when you need the decrypted token cache internally.
 */
export async function getAccountById(id: string, userId: string): Promise<Account | null> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('accounts')
    .select(PUBLIC_COLUMNS)
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as Account;
}

/**
 * INTERNAL ONLY: Get account with decrypted token cache.
 * Never expose the return value directly to API responses.
 */
export async function getAccountWithTokenCache(id: string, userId: string): Promise<Account | null> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('accounts')
    .select('*')
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  // Decrypt token cache for internal use
  if (data.auth_token_cache) {
    try {
      data.auth_token_cache = decrypt(data.auth_token_cache);
    } catch {
      // Token cache corrupted — clear it so user re-authenticates
      data.auth_token_cache = undefined;
    }
  }

  return data as Account;
}

export async function createAccount(payload: CreateAccountPayload, userId: string): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      owner_user_id: userId,
      username: payload.username,
      microsoft_email: payload.microsoft_email,
      auto_reconnect: true,
      reconnect_delay_ms: 5000,
      max_reconnect_attempts: 5,
    })
    .select(PUBLIC_COLUMNS)
    .single();

  if (error) throw error;
  return data as Account;
}

export async function updateAccount(id: string, updates: Partial<Account>, userId: string): Promise<Account> {
  const safeUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Whitelist allowed fields
  if (updates.username !== undefined) safeUpdates.username = updates.username;
  if (updates.microsoft_email !== undefined) safeUpdates.microsoft_email = updates.microsoft_email;
  if (updates.auto_reconnect !== undefined) safeUpdates.auto_reconnect = updates.auto_reconnect;
  if (updates.reconnect_delay_ms !== undefined) safeUpdates.reconnect_delay_ms = updates.reconnect_delay_ms;
  if (updates.max_reconnect_attempts !== undefined) safeUpdates.max_reconnect_attempts = updates.max_reconnect_attempts;

  // Encrypt token cache before storing
  if (updates.auth_token_cache !== undefined) {
    safeUpdates.auth_token_cache = updates.auth_token_cache
      ? encrypt(updates.auth_token_cache)
      : null;
  }

  const scopedQuery = applyOwnerFilter(
    supabase
    .from('accounts')
    .update(safeUpdates)
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.select(PUBLIC_COLUMNS).single();

  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(id: string, userId: string): Promise<void> {
  // Clear token cache before deletion
  await applyOwnerFilter(
    supabase
    .from('accounts')
    .update({ auth_token_cache: null })
    .eq('id', id),
    userId
  );

  const scopedQuery = applyOwnerFilter(
    supabase
    .from('accounts')
    .delete()
    .eq('id', id),
    userId
  );

  const { error } = await scopedQuery;

  if (error) throw error;
}
