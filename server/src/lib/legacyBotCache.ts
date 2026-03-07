import { existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_BOT_CACHE_ROOT = join(__dirname, '../../.bot-cache');

export function removeLegacyBotCache(accountId?: string): void {
  const target = accountId
    ? join(LEGACY_BOT_CACHE_ROOT, accountId)
    : LEGACY_BOT_CACHE_ROOT;

  if (!existsSync(target)) {
    return;
  }

  rmSync(target, { recursive: true, force: true });
}
