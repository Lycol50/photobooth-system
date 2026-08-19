import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { LocalRepository } from '../database/repositories.js';
import type { AppPaths } from './paths.js';
import type { PhotoVault } from './photo-vault.js';
import type { SecretStore } from './secret-store.js';

const DAY_MS = 24 * 60 * 60 * 1_000;

export class RetentionService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly vault: PhotoVault,
    private readonly secrets: SecretStore,
    private readonly paths: AppPaths,
  ) {}

  recoverAfterRestart(now = Date.now()): {
    interrupted: number;
    missingAssets: number;
    corruptAssets: number;
  } {
    const interrupted = this.repository.markInterruptedSessions(now);
    const session = this.repository.getLatestIncompleteSession();
    let missingAssets = 0;
    let corruptAssets = 0;
    if (session) {
      for (const asset of this.repository.listAssets(session.id)) {
        try {
          if (!this.vault.exists(asset.encryptedPath)) missingAssets += 1;
        } catch {
          corruptAssets += 1;
        }
      }
      if (missingAssets > 0 || corruptAssets > 0) {
        this.repository.markSessionAssetUnavailable(session.id, now);
      }
    }
    this.removeAbandonedStaging(now - DAY_MS);
    this.cleanupExpired(now);
    return { interrupted, missingAssets, corruptAssets };
  }

  cleanupExpired(now = Date.now()): { sessionsDeleted: number; assetsDeleted: number } {
    const cutoff = now - 60 * DAY_MS;
    let sessionsDeleted = 0;
    let assetsDeleted = 0;
    for (const session of this.repository.sessionsOlderThan(cutoff)) {
      try {
        this.repository.beginSessionCleanup(session.id, now);
        const tombstones: string[] = [];
        for (const initialAsset of this.repository.listAssets(session.id)) {
          let asset = initialAsset;
          if (asset.cleanupState === 'active') {
            asset = this.repository.prepareAssetTombstone(
              asset.id,
              this.vault.createTombstoneReference(),
            );
          }
          if (!asset.tombstonePath) throw new Error('Cleanup tombstone reference is missing');
          const tombstonePath = asset.tombstonePath;
          if (asset.cleanupState === 'tombstoning') {
            if (!this.vault.stagingExists(tombstonePath)) {
              this.vault.stageDeleteTo(asset.encryptedPath, tombstonePath);
            }
            asset = this.repository.markAssetTombstoned(asset.id);
          }
          tombstones.push(tombstonePath);
        }
        if (session.publicSecretRef) this.secrets.delete(session.publicSecretRef);
        this.repository.deleteSession(session.id);
        for (const reference of tombstones) this.vault.finishTombstone(reference);
        sessionsDeleted += 1;
        assetsDeleted += tombstones.length;
      } catch {
        // Tombstone state is durable; the next startup or daily run resumes from it.
      }
    }
    this.repository.recordAudit('cleanup', 'success', `sessions_${sessionsDeleted}`, now);
    return { sessionsDeleted, assetsDeleted };
  }

  private removeAbandonedStaging(cutoff: number): void {
    const referencedTombstones = new Set(this.repository.listReferencedTombstones());
    for (const name of readdirSync(this.paths.staging)) {
      if (!name.endsWith('.tmp') && !name.endsWith('.delete')) continue;
      const path = join(this.paths.staging, name);
      try {
        const reference = `staging/${name}`;
        if (name.endsWith('.delete')) {
          if (!referencedTombstones.has(reference)) rmSync(path, { force: true });
        } else if (statSync(path).mtimeMs < cutoff) {
          rmSync(path, { force: true });
        }
      } catch {
        // A concurrent atomic write or cleanup owns this file.
      }
    }
  }
}
