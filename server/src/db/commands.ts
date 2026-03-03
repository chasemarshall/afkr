import { supabase } from '../config/supabase.js';
import { applyOwnerFilter } from './ownership.js';
import type { CommandHistoryEntry } from '@afkr/shared';

export async function logCommand(entry: {
  owner_user_id: string;
  account_id: string;
  server_id: string;
  command: string;
  source: 'manual' | 'scheduled';
  scheduled_command_id?: string;
  response?: string;
}): Promise<CommandHistoryEntry> {
  const { data, error } = await supabase
    .from('command_history')
    .insert({
      ...entry,
      executed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as CommandHistoryEntry;
}

export async function getHistory(options: {
  owner_user_id: string;
  account_id?: string;
  limit?: number;
  offset?: number;
}): Promise<CommandHistoryEntry[]> {
  const { owner_user_id, account_id, limit = 50, offset = 0 } = options;

  let query = applyOwnerFilter(
    supabase
    .from('command_history')
    .select('*')
    .order('executed_at', { ascending: false })
    .range(offset, offset + limit - 1),
    owner_user_id
  );

  if (account_id) {
    query = query.eq('account_id', account_id);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as CommandHistoryEntry[];
}
