import { join } from 'node:path';

import pino, { type Logger } from 'pino';

export function createApplicationLogger(logDirectory: string): Logger {
  const destination = pino.destination({
    dest: join(logDirectory, 'grace-booth.ndjson'),
    mkdir: true,
    sync: false,
  });
  return pino(
    {
      level: 'info',
      base: { application: 'grace-booth' },
      redact: {
        paths: [
          '*.passcode',
          '*.password',
          '*.publicToken',
          '*.signedUploadToken',
          '*.accessToken',
          '*.refreshToken',
          '*.authorization',
          '*.apikey',
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers.set-cookie',
          '*.publicUrl',
          '*.path',
        ],
        censor: '[REDACTED]',
      },
      serializers: {
        err: (error: Error) => ({
          name: error.name,
          code: 'code' in error ? error.code : undefined,
        }),
      },
      formatters: {
        log: sanitizeLogObject,
      },
    },
    destination,
  );
}

const SENSITIVE_KEY =
  /(passcode|password|token|authorization|apikey|cookie|url|path|body|bytes|plaintext|ciphertext|secret|encryption|key|session)/i;
const URL_VALUE = /^[a-z][a-z0-9+.-]*:\/\//i;
const ABSOLUTE_PATH_VALUE = /^(?:[a-z]:[\\/]|\/)/i;

export function sanitizeLogObject(input: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(input, new WeakSet<object>(), 0);
}

function sanitizeRecord(
  input: Record<string, unknown>,
  seen: WeakSet<object>,
  depth: number,
): Record<string, unknown> {
  if (seen.has(input) || depth > 8) return { redacted: '[REDACTED]' };
  seen.add(input);
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeLogValue(value, seen, depth + 1);
  }
  return output;
}

function sanitizeLogValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (typeof value === 'string') {
    return URL_VALUE.test(value) || ABSOLUTE_PATH_VALUE.test(value) ? '[REDACTED]' : value;
  }
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return '[REDACTED]';
  if (value instanceof Error) {
    return {
      name: value.name,
      code: 'code' in value ? String(value.code).slice(0, 80) : undefined,
    };
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeLogValue(entry, seen, depth + 1));
  if (typeof value === 'object') {
    return sanitizeRecord(value as Record<string, unknown>, seen, depth);
  }
  return '[REDACTED]';
}
