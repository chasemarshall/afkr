import { timingSafeEqual, createHmac } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
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

/**
 * Constant-time string comparison that does not leak length information.
 * Both inputs are HMAC'd to normalize to the same length before comparison.
 */
function secureCompare(input: string, expected: string): boolean {
  // HMAC both values to normalize length, preventing timing side-channel
  // leaks on differing-length inputs. Key is derived from the instance secret.
  const hmacKey = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  const inputHash = createHmac('sha256', hmacKey).update(input).digest();
  const expectedHash = createHmac('sha256', hmacKey).update(expected).digest();
  return timingSafeEqual(inputHash, expectedHash);
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

function extractApiKeyFromRequest(req: Request): string | undefined {
  const headerKey = req.header('x-api-key');
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }

  const bearer = parseBearer(req.header('authorization'));
  if (bearer && config.ALLOW_ADMIN_API_KEY_FALLBACK) {
    return bearer;
  }

  return undefined;
}

function extractApiKeyFromSocket(handshake: SocketHandshake): string | undefined {
  const authKey = handshake.auth?.apiKey;
  if (typeof authKey === 'string' && authKey.trim().length > 0) {
    return authKey.trim();
  }

  const headerKey = getHeaderAsString(handshake.headers['x-api-key']);
  if (typeof headerKey === 'string' && headerKey.trim().length > 0) {
    return headerKey.trim();
  }

  const authHeader = getHeaderAsString(handshake.headers.authorization);
  const bearer = parseBearer(authHeader);
  if (bearer && config.ALLOW_ADMIN_API_KEY_FALLBACK) {
    return bearer;
  }

  return undefined;
}

function isValidAdminApiKey(value: string | undefined): boolean {
  if (!config.ALLOW_ADMIN_API_KEY_FALLBACK) return false;
  if (!config.ADMIN_API_KEY) return false;
  if (!value) return false;
  return secureCompare(value, config.ADMIN_API_KEY);
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
  if (accessToken) {
    const userId = await getSupabaseUserIdFromAccessToken(accessToken);
    if (userId) return userId;
  }

  const apiKey = extractApiKeyFromRequest(req);
  if (isValidAdminApiKey(apiKey)) {
    return config.ADMIN_FALLBACK_USER_ID ?? null;
  }

  return null;
}

export async function resolveUserIdFromSocketHandshake(
  handshake: SocketHandshake
): Promise<string | null> {
  const accessToken = extractAccessTokenFromSocket(handshake);
  if (accessToken) {
    const userId = await getSupabaseUserIdFromAccessToken(accessToken);
    if (userId) return userId;
  }

  const apiKey = extractApiKeyFromSocket(handshake);
  if (isValidAdminApiKey(apiKey)) {
    return config.ADMIN_FALLBACK_USER_ID ?? null;
  }

  return null;
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
