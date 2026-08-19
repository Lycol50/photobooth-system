import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openBoothDatabase, type BoothDatabase } from '../../src/main/database/database.js';
import { LocalRepository } from '../../src/main/database/repositories.js';
import { createAppPaths, type AppPaths } from '../../src/main/storage/paths.js';
import { PhotoVault } from '../../src/main/storage/photo-vault.js';
import { SecretStore, type PlatformSecretProtection } from '../../src/main/storage/secret-store.js';

export const fakeProtection: PlatformSecretProtection = {
  isAvailable: () => true,
  encryptString: (value) => Buffer.from(value, 'utf8').reverse(),
  decryptString: (value) => Buffer.from(value).reverse().toString('utf8'),
};

export type TestStore = {
  directory: string;
  paths: AppPaths;
  database: BoothDatabase;
  repository: LocalRepository;
  secrets: SecretStore;
  vault: PhotoVault;
  close(): void;
};

export function createTestStore(): TestStore {
  const directory = mkdtempSync(join(tmpdir(), 'grace-booth-test-'));
  const paths = createAppPaths(directory);
  const migrations = fileURLToPath(new URL('../../migrations', import.meta.url));
  const database = openBoothDatabase(paths.database, migrations);
  const repository = new LocalRepository(database);
  const secrets = new SecretStore(paths.secrets, fakeProtection);
  const vault = new PhotoVault(paths, secrets);
  return {
    directory,
    paths,
    database,
    repository,
    secrets,
    vault,
    close: () => {
      database.close();
      const root = resolve(tmpdir());
      const target = resolve(directory);
      if (dirname(target) === root && !relative(root, target).startsWith('..')) {
        rmSync(target, { recursive: true, force: true });
      }
    },
  };
}
