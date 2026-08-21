import { describe, expect, it } from 'vitest';

import { loadRuntimeConfig } from '../../src/main/config.js';

describe('runtime capture timing', () => {
  it('uses the five-second production countdown', () => {
    expect(loadRuntimeConfig({}, false).e2e.countdownMs).toBe(5_000);
  });

  it('limits accelerated test countdowns and failed-shot fixtures to production bounds', () => {
    expect(
      loadRuntimeConfig({ GRACE_BOOTH_E2E: '1', GRACE_BOOTH_E2E_COUNTDOWN_MS: '5000' }, false).e2e
        .countdownMs,
    ).toBe(5_000);
    expect(() =>
      loadRuntimeConfig({ GRACE_BOOTH_E2E: '1', GRACE_BOOTH_E2E_COUNTDOWN_MS: '5001' }, false),
    ).toThrow();
    expect(() =>
      loadRuntimeConfig({ GRACE_BOOTH_E2E: '1', GRACE_BOOTH_E2E_CAPTURE_FAIL_SHOT: '4' }, false),
    ).toThrow();
  });
});
