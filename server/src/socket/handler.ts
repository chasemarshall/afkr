import { Server as SocketServer } from 'socket.io';
import pino from 'pino';
import { botManager } from '../services/BotManager.js';
import { isAdminUserId } from '../db/ownership.js';
import { sanitizeCommand, isValidUuid } from '../middleware/validate.js';
import { SocketEventRateLimiter } from '../middleware/socketRateLimit.js';
import { getScriptById } from '../db/scripts.js';
import { ScriptExecutor } from '../services/ScriptExecutor.js';
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
  move: { max: 600, windowMs: 60_000 },
  jump: { max: 300, windowMs: 60_000 },
  antiAfk: { max: 20, windowMs: 60_000 },
  look: { max: 600, windowMs: 60_000 },
  runScript: { max: 10, windowMs: 60_000 },
  autoClickChat: { max: 20, windowMs: 60_000 },
  sneak: { max: 60, windowMs: 60_000 },
  tabList: { max: 30, windowMs: 60_000 },
} as const;

const VALID_DIRECTIONS = new Set(['forward', 'back', 'left', 'right']);

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

    // Handle bot movement
    socket.on('bot:move', (payload) => {
      try {
        if (!enforceRateLimit(socket.id, 'bot:move', SOCKET_LIMITS.move.max, SOCKET_LIMITS.move.windowMs)) {
          return;
        }
        if (!payload?.account_id || !payload?.direction) return;
        if (!isValidUuid(payload.account_id)) return;
        if (!VALID_DIRECTIONS.has(payload.direction)) return;
        const duration = typeof payload.duration_ms === 'number'
          ? Math.min(Math.max(payload.duration_ms, 100), 2000)
          : 400;
        botManager.moveBot(payload.account_id, payload.direction, userId, duration);
      } catch (err) {
        logger.error({ err }, 'Socket bot:move failed');
      }
    });

    // Handle bot jump
    socket.on('bot:jump', (payload) => {
      try {
        if (!enforceRateLimit(socket.id, 'bot:jump', SOCKET_LIMITS.jump.max, SOCKET_LIMITS.jump.windowMs)) {
          return;
        }
        if (!payload?.account_id) return;
        if (!isValidUuid(payload.account_id)) return;
        botManager.jumpBot(payload.account_id, userId);
      } catch (err) {
        logger.error({ err }, 'Socket bot:jump failed');
      }
    });

    // Handle bot look (mouse yaw/pitch)
    socket.on('bot:look', (payload) => {
      try {
        if (!enforceRateLimit(socket.id, 'bot:look', SOCKET_LIMITS.look.max, SOCKET_LIMITS.look.windowMs)) {
          return;
        }
        if (!payload?.account_id) return;
        if (!isValidUuid(payload.account_id)) return;
        if (typeof payload.yaw_delta !== 'number' || typeof payload.pitch_delta !== 'number') return;
        // Clamp deltas to reasonable values (max ~180 degrees per event)
        const yaw = Math.max(-Math.PI, Math.min(Math.PI, payload.yaw_delta));
        const pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, payload.pitch_delta));
        botManager.lookBot(payload.account_id, yaw, pitch, userId);
      } catch (err) {
        logger.error({ err }, 'Socket bot:look failed');
      }
    });

    // Handle anti-AFK toggle
    socket.on('bot:anti_afk', (payload) => {
      try {
        if (!enforceRateLimit(socket.id, 'bot:anti_afk', SOCKET_LIMITS.antiAfk.max, SOCKET_LIMITS.antiAfk.windowMs)) {
          return;
        }
        if (!payload?.account_id || typeof payload.enabled !== 'boolean') return;
        if (!isValidUuid(payload.account_id)) return;
        const interval = typeof payload.interval_ms === 'number' ? payload.interval_ms : undefined;
        botManager.setAntiAfk(payload.account_id, payload.enabled, userId, interval);
      } catch (err) {
        logger.error({ err }, 'Socket bot:anti_afk failed');
      }
    });

    // Handle auto-click chat toggle
    socket.on('bot:auto_click_chat', (payload) => {
      try {
        if (!enforceRateLimit(socket.id, 'bot:auto_click_chat', SOCKET_LIMITS.autoClickChat.max, SOCKET_LIMITS.autoClickChat.windowMs)) {
          return;
        }
        if (!payload?.account_id || typeof payload.enabled !== 'boolean') return;
        if (!isValidUuid(payload.account_id)) return;
        botManager.setAutoClickChat(payload.account_id, payload.enabled, userId);
      } catch (err) {
        logger.error({ err }, 'Socket bot:auto_click_chat failed');
      }
    });

    // Handle bot script execution via socket
    socket.on('bot:run_script', async (payload) => {
      try {
        if (!enforceRateLimit(socket.id, 'bot:run_script', SOCKET_LIMITS.runScript.max, SOCKET_LIMITS.runScript.windowMs)) {
          return;
        }
        if (!payload?.account_id || !payload?.script_id) return;
        if (!isValidUuid(payload.account_id) || !isValidUuid(payload.script_id)) return;

        const script = await getScriptById(payload.script_id, userId);
        if (!script || script.account_id !== payload.account_id) return;

        const bot = botManager.getBot(payload.account_id, userId);
        if (!bot || bot.getStatus() !== 'online') return;

        const emitStatus = (status: 'running' | 'completed' | 'error', step?: number, error?: string) => {
          for (const client of io.sockets.sockets.values()) {
            const cid = client.data.userId;
            if (!cid) continue;
            if (isAdminUserId(cid) || cid === userId) {
              client.emit('bot:script_status', {
                account_id: payload.account_id,
                script_id: payload.script_id,
                status,
                step,
                error,
              });
            }
          }
        };

        emitStatus('running', 0);
        const executor = new ScriptExecutor();
        executor
          .execute(bot, script.steps, (progress) => {
            emitStatus('running', progress.step);
          })
          .then(() => {
            emitStatus('completed');
            logger.info({ scriptId: script.id }, 'Script completed via socket');
          })
          .catch((err: Error) => {
            emitStatus('error', undefined, err.message);
            logger.error({ scriptId: script.id, err }, 'Script execution failed via socket');
          });
      } catch (err) {
        logger.error({ err }, 'Socket bot:run_script failed');
      }
    });

    // Handle bot sneak toggle
    socket.on('bot:sneak', (payload) => {
      try {
        if (!enforceRateLimit(socket.id, 'bot:sneak', SOCKET_LIMITS.sneak.max, SOCKET_LIMITS.sneak.windowMs)) {
          return;
        }
        if (!payload?.account_id || typeof payload.enabled !== 'boolean') return;
        if (!isValidUuid(payload.account_id)) return;
        botManager.sneakBot(payload.account_id, payload.enabled, userId);
      } catch (err) {
        logger.error({ err }, 'Socket bot:sneak failed');
      }
    });

    // Handle tab list request
    socket.on('bot:tab_list', (payload) => {
      try {
        if (!enforceRateLimit(socket.id, 'bot:tab_list', SOCKET_LIMITS.tabList.max, SOCKET_LIMITS.tabList.windowMs)) {
          return;
        }
        if (!payload?.account_id) return;
        if (!isValidUuid(payload.account_id)) return;
        const entries = botManager.getTabList(payload.account_id, userId);
        socket.emit('bot:tab_list_data', { account_id: payload.account_id, entries });
      } catch (err) {
        logger.error({ err }, 'Socket bot:tab_list failed');
      }
    });

    socket.on('disconnect', () => {
      eventLimiter.clearSocket(socket.id);
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });
}
