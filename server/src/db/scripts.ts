import { supabase } from '../config/supabase.js';
import { applyOwnerFilter } from './ownership.js';
import type { Script, CreateScriptPayload } from '@afkr/shared';

export async function getAllScripts(userId: string): Promise<Script[]> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scripts')
    .select('*')
    .order('created_at', { ascending: false }),
    userId
  );

  const { data, error } = await scopedQuery;

  if (error) throw error;
  return data as Script[];
}

export async function getScriptById(id: string, userId: string): Promise<Script | null> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scripts')
    .select('*')
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Script;
}

export async function getScriptCount(userId: string): Promise<number> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scripts')
    .select('id', { count: 'exact', head: true }),
    userId
  );

  const { count, error } = await scopedQuery;

  if (error) throw error;
  return count ?? 0;
}

export async function createScript(payload: CreateScriptPayload, userId: string): Promise<Script> {
  const { data, error } = await supabase
    .from('scripts')
    .insert({
      owner_user_id: userId,
      account_id: payload.account_id,
      server_id: payload.server_id,
      name: payload.name,
      description: payload.description || null,
      steps: payload.steps,
      enabled: true,
      trigger_type: payload.trigger_type,
      trigger_value: payload.trigger_value || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Script;
}

export async function updateScript(
  id: string,
  updates: Partial<Script>,
  userId: string
): Promise<Script> {
  const safeUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) safeUpdates.name = updates.name;
  if (updates.description !== undefined) safeUpdates.description = updates.description;
  if (updates.steps !== undefined) safeUpdates.steps = updates.steps;
  if (updates.enabled !== undefined) safeUpdates.enabled = updates.enabled;
  if (updates.trigger_type !== undefined) safeUpdates.trigger_type = updates.trigger_type;
  if (updates.trigger_value !== undefined) safeUpdates.trigger_value = updates.trigger_value;

  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scripts')
    .update(safeUpdates)
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.select().single();

  if (error) throw error;
  return data as Script;
}

export async function deleteScript(id: string, userId: string): Promise<void> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('scripts')
    .delete()
    .eq('id', id),
    userId
  );

  const { error } = await scopedQuery;

  if (error) throw error;
}
