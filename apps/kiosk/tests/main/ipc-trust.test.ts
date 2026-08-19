import { describe, expect, it } from 'vitest';

import { assertTrustedIpcSender } from '../../src/main/ipc/sender-trust.js';

describe('typed IPC sender boundary', () => {
  it('accepts only the main frame at the exact packaged app authority', () => {
    expect(() =>
      assertTrustedIpcSender('app://grace-booth/index.html', true, 'app://grace-booth'),
    ).not.toThrow();
    expect(() =>
      assertTrustedIpcSender('app://attacker/index.html', true, 'app://grace-booth'),
    ).toThrow(/not allowed/i);
    expect(() =>
      assertTrustedIpcSender('app://grace-booth/index.html', false, 'app://grace-booth'),
    ).toThrow(/not allowed/i);
  });

  it('rejects malformed and cross-origin development renderer URLs', () => {
    expect(() => assertTrustedIpcSender('not a url', true, 'http://127.0.0.1:5173')).toThrow();
    expect(() =>
      assertTrustedIpcSender('http://127.0.0.1:5173/', true, 'http://127.0.0.1:5173'),
    ).not.toThrow();
    expect(() =>
      assertTrustedIpcSender('http://localhost:5173/', true, 'http://127.0.0.1:5173'),
    ).toThrow(/not allowed/i);
  });
});
