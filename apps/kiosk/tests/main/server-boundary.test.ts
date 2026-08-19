import type { FastifyInstance } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import type { LanCertificateService } from '../../src/main/auth/lan-certificate-service.js';
import type { LocalRepository } from '../../src/main/database/repositories.js';
import { AdminServerManager } from '../../src/main/server/admin-server-manager.js';
import type { LocalAdminDependencies } from '../../src/main/server/local-admin-server.js';
import { validateAdminRequestBoundary } from '../../src/main/server/network-boundary.js';

describe('local admin listener boundary', () => {
  it('requires exact loopback Host, same Origin for writes, and a loopback socket peer', () => {
    const listener = { host: '127.0.0.1', port: 4_311, tls: null };
    expect(
      validateAdminRequestBoundary(listener, {
        method: 'GET',
        host: '127.0.0.1:4311',
        origin: undefined,
        remoteAddress: '::ffff:127.0.0.1',
      }),
    ).toEqual({ allowed: true });
    expect(
      validateAdminRequestBoundary(listener, {
        method: 'GET',
        host: 'localhost:4311',
        origin: undefined,
        remoteAddress: '127.0.0.1',
      }),
    ).toEqual({ allowed: false, reason: 'host' });
    expect(
      validateAdminRequestBoundary(listener, {
        method: 'POST',
        host: '127.0.0.1:4311',
        origin: undefined,
        remoteAddress: '127.0.0.1',
      }),
    ).toEqual({ allowed: false, reason: 'origin' });
    expect(
      validateAdminRequestBoundary(listener, {
        method: 'POST',
        host: '127.0.0.1:4311',
        origin: 'http://127.0.0.1:4311',
        remoteAddress: '192.168.1.9',
      }),
    ).toEqual({ allowed: false, reason: 'peer' });
  });

  it('requires exact HTTPS LAN authority/origin and a private socket peer', () => {
    const listener = { host: '192.168.1.20', port: 4_310, tls: {} };
    expect(
      validateAdminRequestBoundary(listener, {
        method: 'POST',
        host: '192.168.1.20:4310',
        origin: 'https://192.168.1.20:4310',
        remoteAddress: '::ffff:192.168.1.44',
      }),
    ).toEqual({ allowed: true });
    expect(
      validateAdminRequestBoundary(listener, {
        method: 'GET',
        host: '192.168.1.20:4310',
        origin: undefined,
        remoteAddress: '8.8.8.8',
      }),
    ).toEqual({ allowed: false, reason: 'peer' });
  });

  it('keeps loopback healthy after LAN failure and accepts a later reconfiguration', async () => {
    const loopback = fakeServer();
    const lan = fakeServer();
    let invocation = 0;
    const starter = vi.fn((): Promise<FastifyInstance> => {
      invocation += 1;
      if (invocation === 1) return Promise.resolve(loopback);
      if (invocation === 2) return Promise.reject(new Error('invalid PFX'));
      return Promise.resolve(lan);
    });
    const repository = {
      getSettings: () => ({ lanEnabled: true, lanBindHost: '192.168.1.20', lanPort: 4_310 }),
    } as unknown as LocalRepository;
    const certificates = {
      load: () => ({ pfx: Buffer.from('test'), passphrase: 'secret' }),
    } as unknown as LanCertificateService;
    const manager = new AdminServerManager(
      {} as LocalAdminDependencies,
      repository,
      certificates,
      starter,
    );

    await expect(manager.start()).resolves.toBeUndefined();
    expect(manager.getListenerHealth()).toMatchObject({
      loopback: 'healthy',
      lan: 'unavailable',
      code: 'lan_listener_unavailable',
    });
    manager.requestReconfigure();
    await vi.waitFor(() => expect(manager.getListenerHealth().lan).toBe('healthy'));
    expect(starter).toHaveBeenCalledTimes(3);
    await manager.close();
  });
});

function fakeServer(): FastifyInstance {
  return { close: vi.fn().mockResolvedValue(undefined) } as unknown as FastifyInstance;
}
