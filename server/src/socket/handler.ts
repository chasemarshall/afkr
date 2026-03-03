import { Server as SocketServer } from 'socket.io';
import pino from 'pino';
import { botManager } from '../services/BotManager.js';
import { isAdminUserId } from '../db/ownership.js';
import { sanitizeCommand, isValidUuid } from '../middleware/validate.js';
import { SocketEventRateLimiter } from '../middleware/socketRateLimit.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  BotState,
  ChatMessage,
} from '@afkr/shared';

const logger = pino({ name: 'socket' });
const eventLimiter = new SocketEventRateLimiter();

const SOCKET_LIMITS = {
  requestStates: { max: 30, windowMs: 60_000 },
  connect: { max: 12, windowMs: 60_000 },
  disconnect: { max: 24, windowMs: 60_000 },
  command: { max: 90, windowMs: 60_000 },
} as const;

function enforceRateLimit(socketId: string, eventName: string, max: number, windowMs: number): boolean {
  return eventLimiter.isAllowed(socketId, eventName, { max, windowMs });
}

export function setupSocketHandler(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, never, { userId: string }>
): void {
  // Subscribe to BotManager events and broadcast only to owner/admin clients
  botManager.on('bot:state', ({ ownerUserId, state }: { ownerUserId: string; state: BotState }) => {
    for (const client of io.sockets.sockets.values()) {
      const clientUserId = client.data.userId;
      if (!clientUserId) continue;
      if (isAdminUserId(clientUserId) || clientUserId === ownerUserId) {
        client.emit('bot:state', state);
      }
    }
  });

  botManager.on('bot:chat', ({ ownerUserId, message }: { ownerUserId: string; message: ChatMessage }) => {
    for (const client of io.sockets.sockets.values()) {
      const clientUserId = client.data.userId;
      if (!clientUserId) continue;
      if (isAdminUserId(clientUserId) || clientUserId === ownerUserId) {
        client.emit('bot:chat', message);
      }
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    logger.info({ socketId: socket.id }, 'Client connected');

    // Handle client requesting all bot states
    socket.on('bot:request_states', () => {
      const allowed = enforceRateLimit(
        socket.id,
        'bot:request_states',
        SOCKET_LIMITS.requestStates.max,
        SOCKET_LIMITS.requestStates.windowMs
      );
      if (!allowed) {
        logger.warn({ socketId: socket.id }, 'Rate limit exceeded for bot:request_states');
        socket.disconnect(true);
        return;
      }

      const states = botManager.getAllStates(userId);
      socket.emit('bot:all_states', states);
    });

    // Handle bot connect via socket
    socket.on('bot:connect', async (payload) => {
      try {
        const allowed = enforceRateLimit(
          socket.id,
          'bot:connect',
          SOCKET_LIMITS.connect.max,
          SOCKET_LIMITS.connect.windowMs
        );
        if (!allowed) {
          logger.warn({ socketId: socket.id }, 'Rate limit exceeded for bot:connect');
          socket.disconnect(true);
          return;
        }

        if (!payload?.account_id || !payload?.server_id) return;
        if (!isValidUuid(payload.account_id) || !isValidUuid(payload.server_id)) return;

        await botManager.connectBot(payload.account_id, payload.server_id, userId);
        logger.info(
          { accountId: payload.account_id, serverId: payload.server_id },
          'Bot connected via socket'
        );
      } catch (err) {
        logger.error({ err }, 'Socket bot:connect failed');
        const msg = (err as Error).message;
        // Only expose safe error messages to the client
        const safeMessages = ['already connected', 'not found', 'Unauthorized'];
        const safeError = safeMessages.some((s) => msg.includes(s)) ? msg : 'Connection failed';
        socket.emit('bot:state', {
          account_id: payload.account_id,
          status: 'error',
          health: 0,
          food: 0,
          error: safeError,
        });
      }
    });

    // Handle bot disconnect via socket
    socket.on('bot:disconnect', (accountId) => {
      try {
        const allowed = enforceRateLimit(
          socket.id,
          'bot:disconnect',
          SOCKET_LIMITS.disconnect.max,
          SOCKET_LIMITS.disconnect.windowMs
        );
        if (!allowed) {
          logger.warn({ socketId: socket.id }, 'Rate limit exceeded for bot:disconnect');
          socket.disconnect(true);
          return;
        }

        if (!accountId || typeof accountId !== 'string' || !isValidUuid(accountId)) return;

        botManager.disconnectBot(accountId, userId);
        logger.info({ accountId }, 'Bot disconnected via socket');
      } catch (err) {
        logger.error({ err }, 'Socket bot:disconnect failed');
      }
    });

    // Handle bot command via socket
    socket.on('bot:command', async (payload) => {
      try {
        const allowed = enforceRateLimit(
          socket.id,
          'bot:command',
          SOCKET_LIMITS.command.max,
          SOCKET_LIMITS.command.windowMs
        );
        if (!allowed) {
          logger.warn({ socketId: socket.id }, 'Rate limit exceeded for bot:command');
          socket.disconnect(true);
          return;
        }

        if (!payload?.account_id || !payload?.command) return;
        if (!isValidUuid(payload.account_id)) return;
        if (typeof payload.command !== 'string') return;

        const safeCommand = sanitizeCommand(payload.command);
        if (!safeCommand) return;
        await botManager.sendCommand(payload.account_id, safeCommand, userId);
        logger.info(
          { accountId: payload.account_id },
          'Command sent via socket'
        );
      } catch (err) {
        logger.error({ err }, 'Socket bot:command failed');
      }
    });

    socket.on('disconnect', () => {
      eventLimiter.clearSocket(socket.id);
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });
}
