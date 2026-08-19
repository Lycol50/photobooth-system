import { assertEquals, assertThrows } from 'jsr:@std/assert@1.0.14';
import { ApiError } from '../_shared/errors.ts';
import { parsePublicTokenDerivationKey } from '../_shared/env.ts';

Deno.test('token derivation keys accept hex, base64, and base64url with at least 32 bytes', () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const base64 = btoa(String.fromCharCode(...bytes));
  const base64url = base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');

  assertEquals(parsePublicTokenDerivationKey(hex), bytes);
  assertEquals(parsePublicTokenDerivationKey(base64), bytes);
  assertEquals(parsePublicTokenDerivationKey(base64url), bytes);
  assertThrows(
    () => parsePublicTokenDerivationKey('aa'.repeat(31)),
    ApiError,
    'The token service is not configured.',
  );
});
