import {
  constants,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
  closeSync,
  fsyncSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type AtomicWriteOperations = {
  open: typeof openSync;
  write: typeof writeFileSync;
  sync: typeof fsyncSync;
  close: typeof closeSync;
  rename: typeof renameSync;
  remove: typeof rmSync;
};

const DEFAULT_OPERATIONS: AtomicWriteOperations = {
  open: openSync,
  write: writeFileSync,
  sync: fsyncSync,
  close: closeSync,
  rename: renameSync,
  remove: rmSync,
};

export function writeFileAtomic(
  targetPath: string,
  bytes: Uint8Array,
  operations: AtomicWriteOperations = DEFAULT_OPERATIONS,
): void {
  const temporaryPath = join(dirname(targetPath), `.${randomUUID()}.tmp`);
  let descriptor: number | null = null;
  try {
    descriptor = operations.open(
      temporaryPath,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    operations.write(descriptor, bytes);
    operations.sync(descriptor);
    operations.close(descriptor);
    descriptor = null;
    operations.rename(temporaryPath, targetPath);
  } catch (error) {
    if (descriptor !== null) operations.close(descriptor);
    operations.remove(temporaryPath, { force: true });
    throw error;
  }
}
