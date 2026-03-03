import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { isIP } from 'net';
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

const logger = pino({ name: 'routes:servers' });
const router = Router();

function isDisallowedHost(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase();
  if (!host) return true;

  if (host === 'localhost' || host.endsWith('.local')) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map((v) => Number.parseInt(v, 10));
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  if (ipVersion === 6) {
    if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
      return true;
    }
  }

  return false;
}

const hostSchema = z.string().min(1).max(253).refine((value) => !isDisallowedHost(value), {
  message: 'host must be a public address (no localhost/private ranges)',
});

router.param('id', (req, res, next) => validateParamId(req, res, next));

const createServerSchema = z.object({
  name: z.string().min(1).max(128),
  host: hostSchema,
  port: z.number().int().min(1).max(65535),
  version: z.string().optional(),
});

const updateServerSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  host: hostSchema.optional(),
  port: z.number().int().min(1).max(65535).optional(),
  version: z.string().nullable().optional(),
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

    const server = await createServer(parsed.data, userId);
    res.status(201).json(server);
  } catch (err) {
    logger.error({ err }, 'Failed to create server');
    res.status(500).json({ error: 'Failed to create server' });
  }
});

// PUT /api/servers/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const parsed = updateServerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    const { version, ...rest } = parsed.data;
    const server = await updateServer(req.params.id, {
      ...rest,
      ...(version !== null && { version }),
    }, userId);
    res.json(server);
  } catch (err) {
    logger.error({ err }, 'Failed to update server');
    res.status(500).json({ error: 'Failed to update server' });
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
