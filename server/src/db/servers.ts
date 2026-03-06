import { supabase } from '../config/supabase.js';
import { applyOwnerFilter } from './ownership.js';
import type { Server, CreateServerPayload } from '@afkr/shared';

export async function getAllServers(userId: string): Promise<Server[]> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('servers')
    .select('*')
    .order('created_at', { ascending: false }),
    userId
  );

  const { data, error } = await scopedQuery;

  if (error) throw error;
  return data as Server[];
}

export async function getServerById(id: string, userId: string): Promise<Server | null> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('servers')
    .select('*')
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Server;
}

export async function createServer(payload: CreateServerPayload, userId: string): Promise<Server> {
  const { data, error } = await supabase
    .from('servers')
    .insert({
      owner_user_id: userId,
      name: payload.name,
      host: payload.host,
      port: payload.port,
      version: payload.version,
      join_command: payload.join_command,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Server;
}

export async function updateServer(id: string, updates: Partial<Server>, userId: string): Promise<Server> {
  // Whitelist allowed fields — never allow id or owner_user_id to be overwritten
  const safeUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) safeUpdates.name = updates.name;
  if (updates.host !== undefined) safeUpdates.host = updates.host;
  if (updates.port !== undefined) safeUpdates.port = updates.port;
  if (updates.version !== undefined) safeUpdates.version = updates.version;
  if (updates.join_command !== undefined) safeUpdates.join_command = updates.join_command;

  const scopedQuery = applyOwnerFilter(
    supabase
    .from('servers')
    .update(safeUpdates)
    .eq('id', id),
    userId
  );

  const { data, error } = await scopedQuery.select().single();

  if (error) throw error;
  return data as Server;
}

export async function deleteServer(id: string, userId: string): Promise<void> {
  const scopedQuery = applyOwnerFilter(
    supabase
    .from('servers')
    .delete()
    .eq('id', id),
    userId
  );

  const { error } = await scopedQuery;

  if (error) throw error;
}
