import { describe, expect, it } from 'vitest';
import { getLocalIpAddress, isPrivateIpv4 } from '../../src/main/server/lan-ip.js';

describe('Local LAN IP utility', () => {
  it('identifies private IPv4 ranges correctly', () => {
    expect(isPrivateIpv4('192.168.1.100')).toBe(true);
    expect(isPrivateIpv4('192.168.0.1')).toBe(true);
    expect(isPrivateIpv4('10.0.0.1')).toBe(true);
    expect(isPrivateIpv4('10.255.255.255')).toBe(true);
    expect(isPrivateIpv4('172.16.0.1')).toBe(true);
    expect(isPrivateIpv4('172.31.255.255')).toBe(true);

    expect(isPrivateIpv4('8.8.8.8')).toBe(false);
    expect(isPrivateIpv4('172.32.0.1')).toBe(false);
    expect(isPrivateIpv4('127.0.0.1')).toBe(false);
    expect(isPrivateIpv4('0.0.0.0')).toBe(false);
    expect(isPrivateIpv4('invalid')).toBe(false);
  });

  it('returns a valid IP string for the host machine', () => {
    const ip = getLocalIpAddress();
    expect(typeof ip).toBe('string');
    expect(ip.length).toBeGreaterThan(0);
  });
});
