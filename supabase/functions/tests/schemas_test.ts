import { assertEquals, assertThrows } from 'jsr:@std/assert@1.0.14';
import {
  ConfirmUploadSchema,
  CreateOrResumeUploadSchema,
  parseWithSchema,
  PublicPhotoTokenSchema,
} from '../_shared/schemas.ts';

const uuid = 'cda39163-9036-4acd-ae10-0c08fdb39022';
const token = 'A'.repeat(43);

Deno.test('create upload schema accepts a constrained finished JPEG', () => {
  const value = parseWithSchema(CreateOrResumeUploadSchema, {
    action: 'create',
    clientSessionId: uuid,
    contentType: 'image/jpeg',
    byteSize: 2_000_000,
    sha256: 'a'.repeat(64),
    width: 2800,
    height: 1800,
    googleFormsUrl: 'https://docs.google.com/forms/d/e/example/viewform',
  });
  assertEquals(value.action, 'create');
});

Deno.test('create upload schema rejects undersized output and unknown keys', () => {
  assertThrows(() =>
    parseWithSchema(CreateOrResumeUploadSchema, {
      action: 'create',
      clientSessionId: uuid,
      contentType: 'image/jpeg',
      byteSize: 10,
      sha256: 'a'.repeat(64),
      width: 1200,
      height: 800,
      googleFormsUrl: null,
      finalPath: 'caller-controlled.jpg',
    })
  );
});

Deno.test('confirm and public routes accept only their exact token contracts', () => {
  assertEquals(parseWithSchema(ConfirmUploadSchema, { photoSessionId: uuid, publicToken: token }), {
    photoSessionId: uuid,
    publicToken: token,
  });
  assertEquals(parseWithSchema(PublicPhotoTokenSchema, { token }), { token });
  assertThrows(() => parseWithSchema(PublicPhotoTokenSchema, { token, action: 'resolve' }));
});
