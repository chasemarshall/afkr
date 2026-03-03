// === Bot Status ===
export type BotStatus = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'error';

// === Database Models ===
export interface Account {
  id: string;
  owner_user_id: string;
  username: string;
  microsoft_email: string;
  auth_token_cache?: string; // encrypted token cache for prismarine-auth
  auto_reconnect: boolean;
  reconnect_delay_ms: number;
  max_reconnect_attempts: number;
  created_at: string;
  updated_at: string;
}

export interface Server {
  id: string;
  owner_user_id: string;
  name: string;
  host: string;
  port: number;
  version?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountServerConfig {
  id: string;
  owner_user_id: string;
  account_id: string;
  server_id: string;
  auto_connect: boolean;
  join_message?: string;
  created_at: string;
}

export interface ScheduledCommand {
  id: string;
  owner_user_id: string;
  account_id: string;
  server_id: string;
  command: string;
  trigger_type: 'delay' | 'interval' | 'cron' | 'one_time';
  trigger_value: string; // e.g. "30000" for delay, "*/5 * * * *" for cron, ISO date for one_time
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BotSession {
  id: string;
  owner_user_id: string;
  account_id: string;
  server_id: string;
  connected_at: string;
  disconnected_at?: string;
  disconnect_reason?: string;
}

export interface CommandHistoryEntry {
  id: string;
  owner_user_id: string;
  account_id: string;
  server_id: string;
  command: string;
  source: 'manual' | 'scheduled';
  scheduled_command_id?: string;
  executed_at: string;
  response?: string;
}

// === API Payloads ===
export interface CreateAccountPayload {
  username: string;
  microsoft_email: string;
}

export interface CreateServerPayload {
  name: string;
  host: string;
  port: number;
  version?: string;
}

export interface ConnectBotPayload {
  account_id: string;
  server_id: string;
}

export interface SendCommandPayload {
  account_id: string;
  command: string;
}

export interface CreateSchedulePayload {
  account_id: string;
  server_id: string;
  command: string;
  trigger_type: ScheduledCommand['trigger_type'];
  trigger_value: string;
}

// === Socket.IO Events ===
export interface BotState {
  account_id: string;
  status: BotStatus;
  server_id?: string;
  server_name?: string;
  health: number;
  food: number;
  position?: { x: number; y: number; z: number };
  connected_at?: string;
  error?: string;
  reconnect_attempts?: number;
}

export interface ChatMessage {
  account_id: string;
  message: string;
  timestamp: string;
  username?: string;
}

export interface ServerToClientEvents {
  'bot:state': (state: BotState) => void;
  'bot:chat': (msg: ChatMessage) => void;
  'bot:all_states': (states: BotState[]) => void;
  'auth:device_code': (data: { account_id: string; user_code: string; verification_uri: string }) => void;
  'auth:complete': (data: { account_id: string; username: string }) => void;
  'auth:error': (data: { account_id: string; error: string }) => void;
}

export interface ClientToServerEvents {
  'bot:connect': (payload: ConnectBotPayload) => void;
  'bot:disconnect': (account_id: string) => void;
  'bot:command': (payload: SendCommandPayload) => void;
  'bot:request_states': () => void;
}
