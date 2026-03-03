import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter per IP.
 * For production with multiple instances, swap for Redis-backed.
 */
export function rateLimit(opts: { windowMs: number; max: number; message?: string }) {
  const store = new Map<string, RateLimitStore>();
  const { windowMs, max, message = 'too many requests' } = opts;

  // Clean up stale entries every minute
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}
