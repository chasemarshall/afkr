import { lookup, resolveSrv } from 'dns/promises';
import { BlockList, isIP } from 'net';

/** DNS operations timeout after 10 seconds to prevent indefinite hangs */
const DNS_TIMEOUT_MS = 10_000;

/** Wrap a promise with a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

const specialUseBlockList = new BlockList();
const IGNORABLE_SRV_ERRORS = new Set(['ENODATA', 'ENOTFOUND']);

for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  specialUseBlockList.addSubnet(address, prefix, 'ipv4');
}

for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const) {
  specialUseBlockList.addSubnet(address, prefix, 'ipv6');
}

function normalizeHost(rawHost: string): string {
  return rawHost.trim().replace(/\.+$/, '').toLowerCase();
}

function getIpFamily(address: string): 'ipv4' | 'ipv6' | null {
  const version = isIP(address);
  if (version === 4) return 'ipv4';
  if (version === 6) return 'ipv6';
  return null;
}

function assertValidPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('port must be between 1 and 65535');
  }
}

async function resolvePublicAddresses(host: string): Promise<string[]> {
  const family = getIpFamily(host);
  if (family) {
    if (specialUseBlockList.check(host, family)) {
      throw new Error('host must resolve only to public IP addresses');
    }
    return [host];
  }

  const resolved = await withTimeout(lookup(host, { all: true, verbatim: true }), DNS_TIMEOUT_MS, 'DNS lookup');
  const addresses = [...new Set(resolved.map((entry) => entry.address))];
  if (addresses.length === 0) {
    throw new Error('host does not resolve');
  }

  if (addresses.some((address) => isPrivateOrLoopbackAddress(address))) {
    throw new Error('host must resolve only to public IP addresses');
  }

  return addresses;
}

export interface ResolvedMinecraftEndpoint {
  originalHost: string;
  originalPort: number;
  effectiveHost: string;
  effectivePort: number;
  connectAddress: string;
  connectPort: number;
}

export function isPrivateOrLoopbackAddress(address: string): boolean {
  const normalized = normalizeHost(address);
  const family = getIpFamily(normalized);
  return family ? specialUseBlockList.check(normalized, family) : false;
}

export function isDisallowedHostInput(rawHost: string): boolean {
  const host = normalizeHost(rawHost);
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.local')) {
    return true;
  }

  return isPrivateOrLoopbackAddress(host);
}

export async function resolveMinecraftEndpoint(
  rawHost: string,
  port: number
): Promise<ResolvedMinecraftEndpoint> {
  const originalHost = normalizeHost(rawHost);
  assertValidPort(port);

  if (isDisallowedHostInput(originalHost)) {
    throw new Error('host must be a public address (no localhost/private ranges)');
  }

  let effectiveHost = originalHost;
  let effectivePort = port;

  if (!getIpFamily(originalHost) && port === 25565) {
    try {
      const records = await withTimeout(resolveSrv(`_minecraft._tcp.${originalHost}`), DNS_TIMEOUT_MS, 'SRV lookup');
      if (records.length > 0) {
        const [record] = records
          .slice()
          .sort((a, b) => a.priority - b.priority || b.weight - a.weight);
        effectiveHost = normalizeHost(record.name);
        effectivePort = record.port;
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (!err.code || !IGNORABLE_SRV_ERRORS.has(err.code)) {
        throw new Error('failed to resolve server SRV record');
      }
    }
  }

  if (isDisallowedHostInput(effectiveHost)) {
    throw new Error('host must resolve only to public IP addresses');
  }

  const [connectAddress] = await resolvePublicAddresses(effectiveHost);

  return {
    originalHost,
    originalPort: port,
    effectiveHost,
    effectivePort,
    connectAddress,
    connectPort: effectivePort,
  };
}

export async function assertPublicResolvableHost(rawHost: string, port = 25565): Promise<void> {
  await resolveMinecraftEndpoint(rawHost, port);
}
