import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { OfflineDeliveryServer } from '../../src/main/server/offline-delivery-server.js';
import { createTestStore, type TestStore } from './helpers.js';
import type { PublicDeliverySecret } from '../../src/main/cloud/upload-queue.js';

let store: TestStore | null = null;
let server: OfflineDeliveryServer | null = null;

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
  if (store) {
    store.close();
    store = null;
  }
});

describe('Offline Delivery Server', () => {
  it('serves health check and mobile html with token', async () => {
    store = createTestStore();
    const port = 4_321;
    server = new OfflineDeliveryServer(store.repository, store.vault, store.secrets, port);
    await server.start();

    // Health check
    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as { ok?: boolean };
    expect(healthJson.ok).toBe(true);

    // Create session, collage, and delivery secret
    const sessionId = randomUUID();
    store.repository.createSession(sessionId);
    store.database.raw
      .prepare("UPDATE sessions SET state = 'processing', capture_count = 4 WHERE id = ?")
      .run(sessionId);
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const stored = store.vault.write('completed', jpegBytes);
    const assetId = randomUUID();
    store.repository.saveCollageAndQueue(
      {
        id: assetId,
        sessionId,
        kind: 'collage',
        retakeRound: 0,
        shotNumber: null,
        encryptedPath: stored.relativePath,
        width: 1800,
        height: 1200,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        createdAt: Date.now(),
      },
      randomUUID(),
      Date.now(),
    );

    const token = 'test-token-abcdef123456789012345678901234567';
    const secret: PublicDeliverySecret = {
      version: 1,
      photoSessionId: `local-${sessionId}`,
      publicToken: token,
      ready: {
        status: 'ready',
        readyAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        publicPageOrigin: `http://127.0.0.1:${port}`,
        publicPath: '/photo',
      },
    };
    const secretRef = store.secrets.writeNamedJson(`public-delivery-${sessionId}`, secret);
    store.database.raw
      .prepare('UPDATE sessions SET public_secret_ref = ?, collage_asset_id = ? WHERE id = ?')
      .run(secretRef, assetId, sessionId);

    // Register token in server cache
    server.registerToken(token, sessionId, assetId);

    // Fetch /photo/:token
    const pageRes = await fetch(`http://127.0.0.1:${port}/photo/${token}`);
    expect(pageRes.status).toBe(200);
    const html = await pageRes.text();
    expect(html).toContain('Grace Booth');
    expect(html).toContain(`/photo/${token}/image`);

    // Fetch /photo/:token/image
    const imgRes = await fetch(`http://127.0.0.1:${port}/photo/${token}/image`);
    expect(imgRes.status).toBe(200);
    expect(imgRes.headers.get('content-type')).toBe('image/jpeg');
    const bytes = Buffer.from(await imgRes.arrayBuffer());
    expect(bytes).toEqual(jpegBytes);
  });
});
