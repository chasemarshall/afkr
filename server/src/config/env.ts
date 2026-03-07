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

function requireEncryptionKey(key: string): string {
  const value = requireEnv(key).trim();
  // Must be exactly 64 hex chars (32 bytes)
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${key} must be exactly 64 hex characters (32 bytes). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`);
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
  // 32-byte hex key for AES-256-GCM encryption of auth tokens
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ENCRYPTION_KEY: requireEncryptionKey('ENCRYPTION_KEY'),

  // Azure AD app client ID for Microsoft/Xbox auth (MSAL device code flow).
  // Register at https://portal.azure.com → App registrations.
  // Enable "Allow public client flows" and add XboxLive.signin permission.
  AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID || undefined,
} as const;

export const config = rawConfig;
