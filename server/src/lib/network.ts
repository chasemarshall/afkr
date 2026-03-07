import { lookup } from 'dns/promises';
import { isIP } from 'net';

export function isPrivateOrLoopbackAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase();
  const ipVersion = isIP(normalized);

  if (ipVersion === 4) {
    const parts = normalized.split('.').map((v) => Number.parseInt(v, 10));
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }

  if (ipVersion === 6) {
    return normalized === '::1'
      || normalized.startsWith('fe80:')
      || normalized.startsWith('fc')
      || normalized.startsWith('fd');
  }

  return false;
}

export function isDisallowedHostInput(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.local')) {
    return true;
  }

  return isPrivateOrLoopbackAddress(host);
}

export async function assertPublicResolvableHost(rawHost: string): Promise<void> {
  const host = rawHost.trim().toLowerCase();
  if (isDisallowedHostInput(host)) {
    throw new Error('host must be a public address (no localhost/private ranges)');
  }

  if (isIP(host)) {
    return;
  }

  const resolved = await lookup(host, { all: true, verbatim: true });
  if (resolved.length === 0) {
    throw new Error('host does not resolve');
  }

  if (resolved.some((entry) => isPrivateOrLoopbackAddress(entry.address))) {
    throw new Error('host must resolve only to public IP addresses');
  }
}
