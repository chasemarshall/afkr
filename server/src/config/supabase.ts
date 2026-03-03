import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);

export const supabaseAuth = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function getSupabaseUserIdFromAccessToken(token: string): Promise<string | null> {
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}
