import { Request, Response, NextFunction } from 'express';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validate that req.params.id is a valid UUID.
 * Prevents injection via route params.
 */
export function validateParamId(req: Request, res: Response, next: NextFunction) {
  const id = req.params.id;
  if (id && !isValidUuid(id)) {
    res.status(400).json({ error: 'invalid id format' });
    return;
  }
  next();
}

/**
 * Sanitize a chat command string.
 * Strips control characters and limits length.
 */
export function sanitizeCommand(cmd: string): string {
  // Strip control chars except normal whitespace
  // eslint-disable-next-line no-control-regex
  return cmd
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, 256)
    .trim();
}
