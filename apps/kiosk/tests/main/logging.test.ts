import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplicationLogger, sanitizeLogObject } from '../../src/main/logging.js';

let directory: string | null = null;
afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = null;
});

describe('privacy-preserving structured logs', () => {
  it('redacts root/deep/case-variant secrets, URLs, paths, bodies, sessions, and image bytes', async () => {
    const record = {
      PublicToken: 'ROOT_PUBLIC_TOKEN_VALUE',
      nested: {
        pAsScOdE: 'NESTED_PASSCODE_VALUE',
        Authorization: 'Bearer AUTH_VALUE',
        endpoint: 'https://private.example/photo#token',
        localFile: 'C:\\Users\\private\\photo.jpg',
        requestBody: { private: 'BODY_VALUE' },
        imageBytes: Buffer.from('IMAGE_BYTE_VALUE'),
        sessionId: 'SESSION_IDENTIFIER_VALUE',
      },
      safeState: 'healthy',
    };
    const sanitized = JSON.stringify(sanitizeLogObject(record));
    for (const forbidden of [
      'ROOT_PUBLIC_TOKEN_VALUE',
      'NESTED_PASSCODE_VALUE',
      'AUTH_VALUE',
      'private.example',
      'Users',
      'BODY_VALUE',
      'IMAGE_BYTE_VALUE',
      'SESSION_IDENTIFIER_VALUE',
    ]) {
      expect(sanitized).not.toContain(forbidden);
    }

    directory = mkdtempSync(join(tmpdir(), 'grace-booth-log-test-'));
    const logger = createApplicationLogger(directory);
    logger.info(record, 'redaction regression');
    logger.flush();
    const logPath = join(directory, 'grace-booth.ndjson');
    await vi.waitFor(() => expect(readFileSync(logPath, 'utf8')).toContain('redaction regression'));
    const serialized = readFileSync(logPath, 'utf8');
    expect(serialized).toContain('healthy');
    expect(serialized).not.toContain('ROOT_PUBLIC_TOKEN_VALUE');
    expect(serialized).not.toContain('NESTED_PASSCODE_VALUE');
    expect(serialized).not.toContain('private.example');
    expect(serialized).not.toContain('IMAGE_BYTE_VALUE');
  });
});
