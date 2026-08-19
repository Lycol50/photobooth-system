import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';

import { AppError } from '../errors.js';
import { writeFileAtomic } from './atomic-file.js';
import { resolveInside } from './paths.js';

export type PlatformSecretProtection = {
  isAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

export class SecretStore {
  constructor(
    private readonly directory: string,
    private readonly protection: PlatformSecretProtection,
  ) {}

  assertAvailable(): void {
    if (!this.protection.isAvailable()) {
      throw new AppError(
        'secure_storage_unavailable',
        'Windows secure storage is unavailable. The booth cannot start safely.',
      );
    }
  }

  putJson(namespace: string, value: unknown): string {
    const reference = `secrets/${safeNamespace(namespace)}-${randomUUID()}.sealed`;
    this.write(reference, JSON.stringify(value));
    return reference;
  }

  writeNamedJson(name: string, value: unknown): string {
    const reference = `secrets/${safeNamespace(name)}.sealed`;
    this.write(reference, JSON.stringify(value));
    return reference;
  }

  getJson(reference: string): unknown {
    return JSON.parse(this.read(reference)) as unknown;
  }

  replaceJson(reference: string, value: unknown): void {
    this.write(reference, JSON.stringify(value));
  }

  getNamedJson(name: string): unknown {
    const reference = `secrets/${safeNamespace(name)}.sealed`;
    try {
      return this.getJson(reference);
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  }

  delete(reference: string): void {
    rmSync(this.pathFor(reference), { force: true });
  }

  private write(reference: string, plaintext: string): void {
    this.assertAvailable();
    const protectedBytes = this.protection.encryptString(plaintext);
    writeFileAtomic(this.pathFor(reference), protectedBytes);
  }

  private read(reference: string): string {
    this.assertAvailable();
    const protectedBytes = readFileSync(this.pathFor(reference));
    return this.protection.decryptString(protectedBytes);
  }

  private pathFor(reference: string): string {
    const root = resolve(this.directory, '..');
    const normalized = reference.replaceAll('\\', '/');
    if (!normalized.startsWith('secrets/') || basename(normalized) !== normalized.slice(8)) {
      throw new Error('Invalid secret reference');
    }
    const absolute = resolveInside(root, normalized);
    const relation = relative(this.directory, absolute);
    if (relation.startsWith('..')) throw new Error('Invalid secret reference');
    return absolute;
  }
}

function safeNamespace(value: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) throw new Error('Invalid secret namespace');
  return value;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
