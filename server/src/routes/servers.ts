import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pino from 'pino';
import {
  getAllServers,
  getServerById,
  createServer,
  updateServer,
  deleteServer,
} from '../db/servers.js';
import { requireAuthenticatedUserId } from '../middleware/auth.js';
import { validateParamId } from '../middleware/validate.js';
import { assertPublicResolvableHost, isDisallowedHostInput } from '../lib/network.js';

const logger = pino({ name: 'routes:servers' });
const router = Router();

const hostSchema = z.string().min(1).max(253).refine((value) => !isDisallowedHostInput(value), {
  message: 'host must be a public address (no localhost/private ranges)',
});

router.param('id', (req, res, next) => validateParamId(req, res, next));

const createServerSchema = z.object({
  name: z.string().min(1).max(128),
  host: hostSchema,
  port: z.number().int().min(1).max(65535),
  version: z.string().regex(/^[0-9]+\.[0-9]+(\.[0-9]+)?$/, 'version must be in format X.Y or X.Y.Z').optional(),
  join_command: z.string().min(1).max(256).optional(),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  host: hostSchema.optional(),
  port: z.number().int().min(1).max(65535).optional(),
  version: z.string().regex(/^[0-9]+\.[0-9]+(\.[0-9]+)?$/, 'version must be in format X.Y or X.Y.Z').nullable().optional(),
  join_command: z.string().min(1).max(256).nullable().optional(),
});

// GET /api/servers
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const servers = await getAllServers(userId);
    res.json(servers);
  } catch (err) {
    logger.error({ err }, 'Failed to get servers');
    res.status(500).json({ error: 'Failed to get servers' });
  }
});

// GET /api/servers/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const server = await getServerById(req.params.id, userId);
    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }
    res.json(server);
  } catch (err) {
    logger.error({ err }, 'Failed to get server');
    res.status(500).json({ error: 'Failed to get server' });
  }
});

// POST /api/servers
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = createServerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    await assertPublicResolvableHost(parsed.data.host, parsed.data.port);
    const server = await createServer(parsed.data, userId);
    res.status(201).json(server);
  } catch (err) {
    logger.error({ err }, 'Failed to create server');
    const message = (err as Error).message;
    res.status(message.includes('host') ? 400 : 500).json({
      error: message.includes('host') ? message : 'Failed to create server',
    });
  }
});

// PUT /api/servers/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const existing = await getServerById(req.params.id, userId);
    if (!existing) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    const parsed = updateServerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const { version, join_command, ...rest } = parsed.data;
    const nextHost = rest.host ?? existing.host;
    const nextPort = rest.port ?? existing.port;
    await assertPublicResolvableHost(nextHost, nextPort);
    const server = await updateServer(req.params.id, {
      ...rest,
      ...(version !== undefined && { version: version ?? undefined }),
      ...(join_command !== undefined && { join_command: join_command ?? undefined }),
    }, userId);
    res.json(server);
  } catch (err) {
    logger.error({ err }, 'Failed to update server');
    const message = (err as Error).message;
    res.status(message.includes('host') ? 400 : 500).json({
      error: message.includes('host') ? message : 'Failed to update server',
    });
  }
});

// DELETE /api/servers/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    await deleteServer(req.params.id, userId);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, 'Failed to delete server');
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

export default router;
