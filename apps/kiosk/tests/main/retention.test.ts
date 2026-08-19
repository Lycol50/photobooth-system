import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoredAsset } from '../../src/main/database/repositories.js';
import { RetentionService } from '../../src/main/storage/retention-service.js';
import { resolveInside } from '../../src/main/storage/paths.js';
import { createTestStore, type TestStore } from './helpers.js';

const DAY_MS = 24 * 60 * 60 * 1_000;

let store: TestStore | null = null;
afterEach(() => {
  store?.close();
  store = null;
  vi.restoreAllMocks();
});

describe('crash-safe local retention', () => {
  it('expires at the exact sixty-day cutoff but not one millisecond early', () => {
    store = createTestStore();
    const now = 100 * DAY_MS;
    const cutoff = now - 60 * DAY_MS;
    const older = createSessionWithAsset(store, cutoff - 1);
    const exact = createSessionWithAsset(store, cutoff);
    const newer = createSessionWithAsset(store, cutoff + 1);
    const retention = new RetentionService(
      store.repository,
      store.vault,
      store.secrets,
      store.paths,
    );

    expect(retention.cleanupExpired(now)).toEqual({ sessionsDeleted: 2, assetsDeleted: 2 });
    expect(store.repository.getSession(older.sessionId)).toBeNull();
    expect(store.repository.getSession(exact.sessionId)).toBeNull();
    expect(store.repository.getSession(newer.sessionId)).not.toBeNull();
  });

  it.each(['before-rename', 'after-rename', 'after-db-tombstone'] as const)(
    'resumes a cleanup crash at %s',
    (crashPoint) => {
      store = createTestStore();
      const now = 100 * DAY_MS;
      const created = createSessionWithAsset(store, now - 61 * DAY_MS);
      store.repository.beginSessionCleanup(created.sessionId, now);
      const reference = store.vault.createTombstoneReference();
      let asset = store.repository.prepareAssetTombstone(created.asset.id, reference);
      if (crashPoint !== 'before-rename') {
        store.vault.stageDeleteTo(asset.encryptedPath, reference);
      }
      if (crashPoint === 'after-db-tombstone') {
        asset = store.repository.markAssetTombstoned(asset.id);
        expect(asset.cleanupState).toBe('tombstoned');
      }

      const retention = new RetentionService(
        store.repository,
        store.vault,
        store.secrets,
        store.paths,
      );
      expect(retention.cleanupExpired(now)).toEqual({ sessionsDeleted: 1, assetsDeleted: 1 });
      expect(store.repository.getSession(created.sessionId)).toBeNull();
      expect(store.vault.stagingExists(reference)).toBe(false);
    },
  );

  it('preserves referenced tombstones while removing post-session-delete debris', () => {
    store = createTestStore();
    const now = 100 * DAY_MS;
    const live = createSessionWithAsset(store, now);
    const liveReference = store.vault.createTombstoneReference();
    const liveAsset = store.repository.prepareAssetTombstone(live.asset.id, liveReference);
    store.vault.stageDeleteTo(liveAsset.encryptedPath, liveReference);

    const deleted = createSessionWithAsset(store, now);
    const deletedReference = store.vault.createTombstoneReference();
    const deletedAsset = store.repository.prepareAssetTombstone(deleted.asset.id, deletedReference);
    store.vault.stageDeleteTo(deletedAsset.encryptedPath, deletedReference);
    store.repository.deleteSession(deleted.sessionId);

    const retention = new RetentionService(
      store.repository,
      store.vault,
      store.secrets,
      store.paths,
    );
    retention.recoverAfterRestart(now);
    expect(store.vault.stagingExists(liveReference)).toBe(true);
    expect(store.vault.stagingExists(deletedReference)).toBe(false);
  });

  it('deletes the sealed delivery secret before the session row and resumes idempotently', () => {
    store = createTestStore();
    const now = 100 * DAY_MS;
    const created = createSessionWithAsset(store, now - 61 * DAY_MS);
    const secretRef = store.secrets.writeNamedJson(`retention-${created.sessionId}`, {
      token: 'sealed',
    });
    store.database.raw
      .prepare('UPDATE sessions SET public_secret_ref = ? WHERE id = ?')
      .run(secretRef, created.sessionId);
    const deleteSession = vi.spyOn(store.repository, 'deleteSession').mockImplementationOnce(() => {
      throw new Error('simulated crash after secret deletion');
    });
    const retention = new RetentionService(
      store.repository,
      store.vault,
      store.secrets,
      store.paths,
    );

    expect(retention.cleanupExpired(now)).toEqual({ sessionsDeleted: 0, assetsDeleted: 0 });
    expect(store.repository.getSession(created.sessionId)).not.toBeNull();
    expect(() => store?.secrets.getJson(secretRef)).toThrow();

    deleteSession.mockRestore();
    expect(retention.cleanupExpired(now)).toEqual({ sessionsDeleted: 1, assetsDeleted: 1 });
    expect(store.repository.getSession(created.sessionId)).toBeNull();
  });

  it('preserves a tampered referenced asset and enters sanitized operator recovery', () => {
    store = createTestStore();
    const now = 100 * DAY_MS;
    const created = createSessionWithAsset(store, now);
    const path = resolveInside(store.paths.root, created.asset.encryptedPath);
    const encrypted = readFileSync(path);
    encrypted[encrypted.length - 1] = (encrypted.at(-1) ?? 0) ^ 1;
    writeFileSync(path, encrypted);
    const retention = new RetentionService(
      store.repository,
      store.vault,
      store.secrets,
      store.paths,
    );

    expect(retention.recoverAfterRestart(now)).toMatchObject({
      missingAssets: 0,
      corruptAssets: 1,
    });
    expect(store.repository.requireSession(created.sessionId)).toMatchObject({
      state: 'interrupted',
      lastErrorCode: 'local_asset_unavailable',
    });
    expect(readFileSync(path).byteLength).toBeGreaterThan(0);
  });
});

function createSessionWithAsset(
  testStore: TestStore,
  createdAt: number,
): { sessionId: string; asset: StoredAsset } {
  const sessionId = randomUUID();
  const assetId = randomUUID();
  testStore.repository.createSession(sessionId, createdAt);
  const stored = testStore.vault.write('pending', Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  testStore.database.raw
    .prepare(
      `INSERT INTO session_assets
        (id, session_id, kind, retake_round, shot_number, encrypted_path, content_type,
          width, height, byte_size, sha256, created_at)
      VALUES (?, ?, 'capture', 0, 1, ?, 'image/jpeg', 1, 1, ?, ?, ?)`,
    )
    .run(assetId, sessionId, stored.relativePath, stored.byteSize, stored.sha256, createdAt);
  const asset = testStore.repository.getAsset(assetId);
  if (!asset) throw new Error('test asset was not created');
  return { sessionId, asset };
}
