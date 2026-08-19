import { networkInterfaces } from 'node:os';

/**
 * Returns the primary private IPv4 address of this machine (e.g. 192.168.x.x, 10.x.x.x).
 * If no non-internal network interface is available, falls back to 127.0.0.1.
 */
export function getLocalIpAddress(): string {
  const interfaces = networkInterfaces();
  const candidates: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (!list) continue;

    for (const net of list) {
      const isIpv4 = net.family === 'IPv4' || (net.family as unknown) === 4;
      if (!isIpv4 || net.internal) continue;

      if (isPrivateIpv4(net.address)) {
        const lowerName = name.toLowerCase();
        if (
          lowerName.includes('wi-fi') ||
          lowerName.includes('wlan') ||
          lowerName.includes('wireless') ||
          lowerName.includes('ethernet') ||
          lowerName.includes('eth') ||
          lowerName.includes('en')
        ) {
          return net.address;
        }
        candidates.push(net.address);
      }
    }
  }

  return candidates[0] ?? '127.0.0.1';
}

export function isPrivateIpv4(value: string): boolean {
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
