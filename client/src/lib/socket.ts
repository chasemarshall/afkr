import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@afkr/shared';

const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY as string | undefined;
const ACCESS_TOKEN_STORAGE_KEY = 'afkr_access_token';

function getAccessToken(): string | null {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  window.location.origin,
  {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: (cb) => {
      const token = getAccessToken();
      cb({
        ...(token ? { token } : {}),
        ...(ADMIN_API_KEY ? { apiKey: ADMIN_API_KEY } : {}),
      });
    },
  }
);
