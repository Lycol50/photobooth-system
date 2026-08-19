import {
  closeSync,
  fsyncSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writeFileAtomic, type AtomicWriteOperations } from '../../src/main/storage/atomic-file.js';

let directory: string | null = null;
afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = null;
});

describe('atomic local file writes', () => {
  it('keeps the previous target and removes exact staging debris when rename fails', () => {
    directory = mkdtempSync(join(tmpdir(), 'grace-booth-atomic-test-'));
    const target = join(directory, 'sealed-value');
    writeFileSync(target, 'previous');
    const operations: AtomicWriteOperations = {
      open: openSync,
      write: writeFileSync,
      sync: fsyncSync,
      close: closeSync,
      rename: () => {
        throw new Error('injected rename failure');
      },
      remove: rmSync,
    };

    expect(() => writeFileAtomic(target, Buffer.from('replacement'), operations)).toThrow(
      /rename failure/,
    );
    expect(readFileSync(target, 'utf8')).toBe('previous');
    expect(readdirSync(directory)).toEqual(['sealed-value']);
  });

  it('publishes the complete replacement through a same-directory rename', () => {
    directory = mkdtempSync(join(tmpdir(), 'grace-booth-atomic-test-'));
    const target = join(directory, 'sealed-value');
    writeFileAtomic(target, Buffer.from('complete'));
    expect(readFileSync(target, 'utf8')).toBe('complete');
    expect(readdirSync(directory)).toEqual(['sealed-value']);
    expect(renameSync).toBeDefined();
  });
});
