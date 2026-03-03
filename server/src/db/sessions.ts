import { supabase } from '../config/supabase.js';
import { applyOwnerFilter } from './ownership.js';
import type { BotSession } from '@afkr/shared';

export async function createSession(
  accountId: string,
  serverId: string,
  userId: string
): Promise<BotSession> {
  const { data, error } = await supabase
    .from('bot_sessions')
    .insert({
      owner_user_id: userId,
      account_id: accountId,
      server_id: serverId,
      connected_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as BotSession;
}

export async function endSession(
  sessionId: string,
  userId: string,
  reason?: string
): Promise<BotSession> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('bot_sessions')
    .update({
      disconnected_at: new Date().toISOString(),
      disconnect_reason: reason,
    })
    .eq('id', sessionId),
    userId
  );

  const { data, error } = await scopedQuery.select().single();

  if (error) throw error;
  return data as BotSession;
}

export async function getActiveSessions(userId: string): Promise<BotSession[]> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('bot_sessions')
    .select('*')
    .is('disconnected_at', null)
    .order('connected_at', { ascending: false }),
    userId
  );

  const { data, error } = await scopedQuery;

  if (error) throw error;
  return data as BotSession[];
}

export async function getSessionsByAccount(accountId: string, userId: string): Promise<BotSession[]> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('bot_sessions')
    .select('*')
    .eq('account_id', accountId)
    .order('connected_at', { ascending: false }),
    userId
  );

  const { data, error } = await scopedQuery;

  if (error) throw error;
  return data as BotSession[];
}
