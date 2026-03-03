import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@afkr/shared';
import { supabase } from './supabase';

const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY as string | undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  window.location.origin,
  {
    autoConnect: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: async (cb) => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      cb({
        ...(token ? { token } : {}),
        ...(ADMIN_API_KEY ? { apiKey: ADMIN_API_KEY } : {}),
      });
    },
  }
);
