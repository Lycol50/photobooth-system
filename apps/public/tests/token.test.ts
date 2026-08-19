import { describe, expect, it } from 'vitest';
import { tokenFromFragment } from '../src/token';

describe('tokenFromFragment', () => {
  it('accepts only one 32-byte base64url token', () => {
    const token = 'A'.repeat(43);
    expect(tokenFromFragment(`#${token}`)).toBe(token);
    expect(tokenFromFragment(token)).toBe(token);
  });

  it('rejects missing, short, encoded, and decorated fragments', () => {
    expect(tokenFromFragment('')).toBeNull();
    expect(tokenFromFragment(`#${'A'.repeat(42)}`)).toBeNull();
    expect(tokenFromFragment(`#${'A'.repeat(43)}/download`)).toBeNull();
    expect(tokenFromFragment(`#${'A'.repeat(42)}%2F`)).toBeNull();
  });
});
