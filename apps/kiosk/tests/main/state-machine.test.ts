import { SessionStateSchema } from '@grace-booth/shared';
import { describe, expect, it } from 'vitest';

import {
  LEGAL_TRANSITIONS,
  SESSION_EVENTS,
  reduceSessionState,
} from '../../src/main/workflow/session-state-machine.js';

describe('authoritative session reducer', () => {
  it('exhaustively accepts only the declared state/event matrix', () => {
    for (const state of SessionStateSchema.options) {
      for (const event of SESSION_EVENTS) {
        const expected = LEGAL_TRANSITIONS[state][event];
        if (expected) expect(reduceSessionState(state, event)).toBe(expected);
        else expect(() => reduceSessionState(state, event)).toThrow();
      }
    }
  });

  it('permits final only after branded readiness is converted to QR', () => {
    expect(reduceSessionState('uploading', 'confirmation_ready')).toBe('ready');
    expect(() => reduceSessionState('uploading', 'qr_ready')).toThrow();
    expect(reduceSessionState('ready', 'qr_ready')).toBe('final');
  });
});
