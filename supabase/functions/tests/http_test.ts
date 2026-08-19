import { assertEquals, assertRejects } from 'jsr:@std/assert@1.0.14';
import { ApiError } from '../_shared/errors.ts';
import { assertExactOrigin, readJson } from '../_shared/http.ts';

Deno.test('readJson requires JSON and enforces the byte limit', async () => {
  const valid = new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ safe: true }),
  });
  assertEquals(await readJson(valid), { safe: true });

  const oversized = new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'x'.repeat(100) }),
  });
  await assertRejects(() => readJson(oversized, 20), ApiError);
});

Deno.test('assertExactOrigin compares the complete serialized origin', () => {
  const request = new Request('https://api.example.test', {
    headers: { Origin: 'https://photos.example.org' },
  });
  assertEquals(assertExactOrigin(request, 'https://photos.example.org'), undefined);
  try {
    assertExactOrigin(request, 'https://other.example.org');
    throw new Error('Expected origin validation to fail');
  } catch (error) {
    assertEquals(error instanceof ApiError, true);
  }
});
