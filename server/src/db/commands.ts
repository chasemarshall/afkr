import { supabase } from '../config/supabase.js';
import { applyOwnerFilter } from './ownership.js';
import type { CommandHistoryEntry } from '@afkr/shared';

const HISTORY_SCRUB_BATCH_SIZE = 200;

function redactCommandForStorage(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) {
    return '[redacted]';
  }

  if (!trimmed.startsWith('/')) {
    return '[chat message redacted]';
  }

  const [verb] = trimmed.split(/\s+/, 1);
  return trimmed === verb ? verb : `${verb} [redacted]`;
}

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
      command: redactCommandForStorage(entry.command),
      executed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as CommandHistoryEntry;
}

export async function scrubHistoricalCommands(): Promise<void> {
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('command_history')
      .select('id, command')
      .order('executed_at', { ascending: false })
      .range(offset, offset + HISTORY_SCRUB_BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const redacted = redactCommandForStorage(row.command);
      if (redacted === row.command) {
        continue;
      }

      const { error: updateError } = await supabase
        .from('command_history')
        .update({ command: redacted })
        .eq('id', row.id);

      if (updateError) throw updateError;
    }

    if (data.length < HISTORY_SCRUB_BATCH_SIZE) {
      break;
    }
    offset += HISTORY_SCRUB_BATCH_SIZE;
  }
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
  return (data as CommandHistoryEntry[]).map((entry) => ({
    ...entry,
    command: redactCommandForStorage(entry.command),
  }));
}
