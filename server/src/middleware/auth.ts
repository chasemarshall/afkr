import { Request, Response, NextFunction } from 'express';
import { getSupabaseUserIdFromAccessToken } from '../config/supabase.js';

type SocketHandshake = {
  auth?: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function parseBearer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.toLowerCase().startsWith('bearer ')) return undefined;
  const token = value.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

function getHeaderAsString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

function extractAccessTokenFromRequest(req: Request): string | undefined {
  return parseBearer(req.header('authorization'));
}

function extractAccessTokenFromSocket(handshake: SocketHandshake): string | undefined {
  const authToken = handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    return authToken.trim();
  }

  const authHeader = getHeaderAsString(handshake.headers.authorization);
  return parseBearer(authHeader);
}

export async function resolveUserIdFromRequest(req: Request): Promise<string | null> {
  const accessToken = extractAccessTokenFromRequest(req);
  if (!accessToken) {
    return null;
  }

  const userId = await getSupabaseUserIdFromAccessToken(accessToken);
  return userId ?? null;
}

export async function resolveUserIdFromSocketHandshake(
  handshake: SocketHandshake
): Promise<string | null> {
  const accessToken = extractAccessTokenFromSocket(handshake);
  if (!accessToken) {
    return null;
  }

  const userId = await getSupabaseUserIdFromAccessToken(accessToken);
  return userId ?? null;
}

export async function requireUserAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const userId = await resolveUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  req.userId = userId;
  next();
}

export function requireAuthenticatedUserId(req: Request): string {
  if (!req.userId) {
    throw new Error('Missing authenticated user');
  }
  return req.userId;
}
