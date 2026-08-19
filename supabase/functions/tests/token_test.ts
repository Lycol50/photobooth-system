import { assertEquals, assertMatch, assertNotEquals, assertRejects } from 'jsr:@std/assert@1.0.14';
import { derivePublicToken, hashPublicToken, sha256Hex } from '../_shared/token.ts';

Deno.test('derivePublicToken is stable for one idempotency key and distinct across sessions', async () => {
  const key = Uint8Array.from({ length: 32 }, (_, index) => index);
  const owner = '11111111-1111-4111-8111-111111111111';
  const first = await derivePublicToken(key, owner, '22222222-2222-4222-8222-222222222222');
  const replay = await derivePublicToken(key, owner, '22222222-2222-4222-8222-222222222222');
  const canonicalReplay = await derivePublicToken(
    key,
    owner.toUpperCase(),
    '22222222-2222-4222-8222-222222222222'.toUpperCase(),
  );
  const second = await derivePublicToken(key, owner, '33333333-3333-4333-8333-333333333333');
  assertMatch(first, /^[A-Za-z0-9_-]{43}$/);
  assertMatch(second, /^[A-Za-z0-9_-]{43}$/);
  assertEquals(first, replay);
  assertEquals(first, canonicalReplay);
  assertNotEquals(first, second);
});

Deno.test('derivePublicToken rejects weak keys and malformed identifiers', async () => {
  const owner = '11111111-1111-4111-8111-111111111111';
  const session = '22222222-2222-4222-8222-222222222222';
  await assertRejects(() => derivePublicToken(new Uint8Array(31), owner, session), TypeError);
  await assertRejects(() => derivePublicToken(new Uint8Array(32), owner, 'not-a-uuid'), TypeError);
});

Deno.test('sha256Hex matches the standard SHA-256 vector', async () => {
  assertEquals(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

Deno.test('hashPublicToken hashes the raw token and is deterministic', async () => {
  const token = 'A'.repeat(43);
  const first = await hashPublicToken(token);
  assertEquals(first, await hashPublicToken(token));
  assertMatch(first, /^[a-f0-9]{64}$/);
});
