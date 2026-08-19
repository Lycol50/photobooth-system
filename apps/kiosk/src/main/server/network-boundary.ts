import { AppError } from '../errors.js';

export type AdminBoundaryListener = {
  host: string;
  port: number;
  tls: object | null;
};

export type AdminBoundaryRequest = {
  method: string;
  host: string | undefined;
  origin: string | undefined;
  remoteAddress: string | undefined;
};

export type AdminBoundaryResult =
  | { allowed: true }
  | { allowed: false; reason: 'host' | 'origin' | 'peer' };

export function validateAdminRequestBoundary(
  options: AdminBoundaryListener,
  request: AdminBoundaryRequest,
): AdminBoundaryResult {
  const expectedAuthority = `${options.host}:${options.port}`;
  if (request.host !== expectedAuthority) return { allowed: false, reason: 'host' };

  const expectedOrigin = `${options.tls ? 'https' : 'http'}://${expectedAuthority}`;
  const requiresOrigin = !['GET', 'HEAD'].includes(request.method.toUpperCase());
  if (
    (requiresOrigin && request.origin !== expectedOrigin) ||
    (request.origin !== undefined && request.origin !== expectedOrigin)
  ) {
    return { allowed: false, reason: 'origin' };
  }

  const peer = normalizeSocketAddress(request.remoteAddress);
  if (options.host === '127.0.0.1') {
    return peer === '127.0.0.1' ? { allowed: true } : { allowed: false, reason: 'peer' };
  }
  return peer !== null && isPrivateIpv4(peer)
    ? { allowed: true }
    : { allowed: false, reason: 'peer' };
}

export function assertPrivateIpv4(value: string): void {
  if (!isPrivateIpv4(value) || value === '0.0.0.0') {
    throw new AppError('lan_host_invalid', 'LAN access requires an exact private IPv4 address.');
  }
}

function normalizeSocketAddress(value: string | undefined): string | null {
  if (!value) return null;
  if (value === '::1') return '127.0.0.1';
  return value.startsWith('::ffff:') ? value.slice(7) : value;
}

function isPrivateIpv4(value: string): boolean {
  const parts = value.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
