export const DEFAULT_PORT = 25565;
export const DEFAULT_RECONNECT_DELAY = 5000;
export const MAX_RECONNECT_ATTEMPTS = 10;
export const BACKOFF_MULTIPLIER = 1.5;
export const MAX_BACKOFF_DELAY = 60000;

export const BOT_STATUS_COLORS: Record<string, string> = {
  online: '#a6e3a1',
  connecting: '#89b4fa',
  reconnecting: '#f9e2af',
  error: '#f38ba8',
  offline: '#585b70',
};
