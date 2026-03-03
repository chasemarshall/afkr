import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return parsed;
}

function parseClientUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('CLIENT_URL must use http or https');
    }
    return url.origin;
  } catch {
    throw new Error('CLIENT_URL must be a valid absolute URL');
  }
}

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function requireStrongSecret(key: string, minLength: number): string {
  const value = requireEnv(key).trim();
  if (value.length < minLength) {
    throw new Error(`${key} must be at least ${minLength} characters long`);
  }
  return value;
}

function optionalStrongSecret(key: string, minLength: number): string | undefined {
  const raw = process.env[key];
  if (!raw) return undefined;
  const value = raw.trim();
  if (value.length < minLength) {
    throw new Error(`${key} must be at least ${minLength} characters long when set`);
  }
  return value;
}

function optionalUuid(key: string): string | undefined {
  const raw = process.env[key];
  if (!raw) return undefined;
  const value = raw.trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new Error(`${key} must be a valid UUID`);
  }
  return value;
}

const rawConfig = {
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_KEY: requireEnv('SUPABASE_SERVICE_KEY'),
  PORT: parsePort(process.env.PORT || '3001'),
  CLIENT_URL: parseClientUrl(process.env.CLIENT_URL || 'http://localhost:5173'),
  TRUST_PROXY: parseBoolean(process.env.TRUST_PROXY, false),
  ALLOW_ADMIN_API_KEY_FALLBACK: parseBoolean(process.env.ALLOW_ADMIN_API_KEY_FALLBACK, false),
  ADMIN_API_KEY: optionalStrongSecret('ADMIN_API_KEY', 32),
  ADMIN_FALLBACK_USER_ID: optionalUuid('ADMIN_FALLBACK_USER_ID'),
  // 32-byte hex key for AES-256-GCM encryption of auth tokens
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ENCRYPTION_KEY: requireEnv('ENCRYPTION_KEY'),
} as const;

if (rawConfig.ALLOW_ADMIN_API_KEY_FALLBACK) {
  if (!rawConfig.ADMIN_API_KEY) {
    throw new Error('ADMIN_API_KEY is required when ALLOW_ADMIN_API_KEY_FALLBACK=true');
  }
  if (!rawConfig.ADMIN_FALLBACK_USER_ID) {
    throw new Error('ADMIN_FALLBACK_USER_ID is required when ALLOW_ADMIN_API_KEY_FALLBACK=true');
  }
}

export const config = rawConfig;
