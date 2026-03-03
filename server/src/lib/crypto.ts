import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
// NIST recommends 12 bytes (96 bits) for GCM IVs — this is the only length
// where GCM avoids an extra GHASH step and provides maximum security margin.
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  cachedKey = key;
  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

// Legacy IV length for backward-compatible decryption of data encrypted
// before the IV was corrected to 12 bytes.
const LEGACY_IV_LENGTH = 16;

/**
 * Decrypt a value encrypted by encrypt().
 * Supports both 12-byte (current) and 16-byte (legacy) IV lengths.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const combined = Buffer.from(encryptedBase64, 'base64');

  // Try current IV length first, fall back to legacy
  const ivLengths = [IV_LENGTH, LEGACY_IV_LENGTH];

  for (const ivLen of ivLengths) {
    if (combined.length <= ivLen + TAG_LENGTH) {
      continue;
    }

    try {
      const iv = combined.subarray(0, ivLen);
      const tag = combined.subarray(ivLen, ivLen + TAG_LENGTH);
      const ciphertext = combined.subarray(ivLen + TAG_LENGTH);

      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch {
      // Try next IV length
      continue;
    }
  }

  throw new Error('Invalid encrypted payload');
}
