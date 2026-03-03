import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import { config } from './config/env.js';
import {
  requireUserAuth,
  resolveUserIdFromSocketHandshake,
} from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { setupSocketHandler } from './socket/handler.js';
import { schedulerService } from './services/SchedulerService.js';
import { botManager } from './services/BotManager.js';
import accountsRouter from './routes/accounts.js';
import serversRouter from './routes/servers.js';
import botsRouter from './routes/bots.js';
import schedulesRouter from './routes/schedules.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from '@afkr/shared';

const logger = pino({
  name: 'server',
  // Redact sensitive fields that could appear in serialized error objects
  redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
});

// Prevent unhandled errors from printing stack traces with sensitive info
process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message }, 'Uncaught exception — shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : 'Unknown rejection';
  logger.fatal({ reason: msg }, 'Unhandled rejection');
});

const app = express();
app.set('trust proxy', config.TRUST_PROXY);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://static.cloudflareinsights.com"],
      connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co", `wss://${new URL(config.CLIENT_URL).host}`],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
}));
app.disable('x-powered-by');

// CORS - strict origin
app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Body parsing with size limits — payloads in this API are small (JSON with UUIDs, short strings)
app.use(express.json({ limit: '100kb' }));

// Global rate limit: 100 requests per minute per IP
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Health check (inside rate limit to prevent abuse)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Stricter rate limit on auth endpoints
app.use('/api/accounts/:id/auth', rateLimit({
  windowMs: 300_000,   // 5 minutes
  max: 5,              // 5 auth attempts per 5 min
  message: 'too many auth attempts, try again later',
}));

// Require authenticated user for all control-plane API routes
app.use('/api', requireUserAuth);

// API routes
app.use('/api/accounts', accountsRouter);
app.use('/api/servers', serversRouter);
app.use('/api/bots/connect', rateLimit({ windowMs: 60_000, max: 10 }));
app.use('/api/bots/disconnect', rateLimit({ windowMs: 60_000, max: 20 }));
app.use('/api/bots/command', rateLimit({ windowMs: 60_000, max: 60 }));
app.use('/api/bots', botsRouter);
app.use('/api/schedules', schedulesRouter);

// Global error handler — never leak stack traces or internal details to clients
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err: err.message }, 'Unhandled error');
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve client static files in production
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api') || _req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(join(clientDist, 'index.html'));
});

// Create HTTP + Socket.IO servers
const httpServer = createServer(app);

const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, never, { userId: string }>(httpServer, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Socket.IO security
  maxHttpBufferSize: 1e6, // 1MB max message size
  pingTimeout: 20_000,
  pingInterval: 25_000,
  connectTimeout: 10_000,
});

io.use((socket, next) => {
  const hasToken = !!socket.handshake.auth?.token;
  const hasApiKey = !!socket.handshake.auth?.apiKey;
  logger.info({ hasToken, hasApiKey, origin: socket.handshake.headers.origin }, 'Socket auth attempt');
  resolveUserIdFromSocketHandshake(socket.handshake)
    .then((userId) => {
      if (!userId) {
        logger.warn({ hasToken, hasApiKey }, 'Socket auth rejected');
        next(new Error('unauthorized'));
        return;
      }

      socket.data.userId = userId;
      next();
    })
    .catch(() => {
      next(new Error('unauthorized'));
    });
});

// Export io for use in routes that need to emit events
export { io };

// Setup socket handlers
setupSocketHandler(io);

// Graceful shutdown — disconnect all bots so they don't linger after restart
function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal — disconnecting all bots');
  botManager.shutdownAll();
  schedulerService.stopAll();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5s if something hangs
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
httpServer.listen(config.PORT, async () => {
  logger.info({ port: config.PORT }, 'Server started');

  // Load scheduled commands
  await schedulerService.loadSchedules();
  logger.info('Scheduler initialized');

  // Restore bots that were online before last shutdown/restart
  await botManager.restoreAll();
});
