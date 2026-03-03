import { supabase } from '../config/supabase.js';
import { applyOwnerFilter } from './ownership.js';
import type { ScheduledCommand, CreateSchedulePayload } from '@afkr/shared';

export async function getAllSchedules(userId: string): Promise<ScheduledCommand[]> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scheduled_commands')
    .select('*')
    .order('created_at', { ascending: false }),
    userId
  );

  const { data, error } = await scopedQuery;

  if (error) throw error;
  return data as ScheduledCommand[];
}

export async function getScheduleById(id: string, userId: string): Promise<ScheduledCommand | null> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scheduled_commands')
    .select('*')
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ScheduledCommand;
}

export async function getSchedulesByAccountAndServer(
  accountId: string,
  serverId: string,
  userId: string
): Promise<ScheduledCommand[]> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scheduled_commands')
    .select('*')
    .eq('account_id', accountId)
    .eq('server_id', serverId)
    .order('created_at', { ascending: false }),
    userId
  );

  const { data, error } = await scopedQuery;

  if (error) throw error;
  return data as ScheduledCommand[];
}

export async function getEnabledSchedules(): Promise<ScheduledCommand[]> {
  const { data, error } = await supabase
    .from('scheduled_commands')
    .select('*')
    .eq('enabled', true);

  if (error) throw error;
  return data as ScheduledCommand[];
}

export async function createSchedule(payload: CreateSchedulePayload, userId: string): Promise<ScheduledCommand> {
  const { data, error } = await supabase
    .from('scheduled_commands')
    .insert({
      owner_user_id: userId,
      account_id: payload.account_id,
      server_id: payload.server_id,
      command: payload.command,
      trigger_type: payload.trigger_type,
      trigger_value: payload.trigger_value,
      enabled: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ScheduledCommand;
}

export async function updateSchedule(
  id: string,
  updates: Partial<ScheduledCommand>,
  userId: string
): Promise<ScheduledCommand> {
  // Whitelist allowed fields — never allow id, owner_user_id, account_id, server_id to be overwritten
  const safeUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.command !== undefined) safeUpdates.command = updates.command;
  if (updates.trigger_type !== undefined) safeUpdates.trigger_type = updates.trigger_type;
  if (updates.trigger_value !== undefined) safeUpdates.trigger_value = updates.trigger_value;
  if (updates.enabled !== undefined) safeUpdates.enabled = updates.enabled;
  if (updates.last_run_at !== undefined) safeUpdates.last_run_at = updates.last_run_at;
  if (updates.next_run_at !== undefined) safeUpdates.next_run_at = updates.next_run_at;

  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scheduled_commands')
    .update(safeUpdates)
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.select().single();

  if (error) throw error;
  return data as ScheduledCommand;
}

export async function deleteSchedule(id: string, userId: string): Promise<void> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scheduled_commands')
    .delete()
    .eq('id', id),
    userId
  );

  const { error } = await scopedQuery;

  if (error) throw error;
}
