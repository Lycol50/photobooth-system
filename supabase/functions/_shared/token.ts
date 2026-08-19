import { PUBLIC_TOKEN_BYTES, PUBLIC_TOKEN_PATTERN, UUID_PATTERN } from './constants.ts';
import { bytesToBase64Url, bytesToHex, encodeUtf8 } from './encoding.ts';

const PUBLIC_TOKEN_DOMAIN = 'grace-booth/public-token/v1';

export function isPublicToken(value: string): boolean {
  return PUBLIC_TOKEN_PATTERN.test(value);
}

export async function derivePublicToken(
  derivationKey: Uint8Array,
  ownerUserId: string,
  clientSessionId: string,
): Promise<string> {
  if (derivationKey.byteLength < 32) {
    throw new TypeError('Invalid public token derivation key');
  }
  if (!UUID_PATTERN.test(ownerUserId) || !UUID_PATTERN.test(clientSessionId)) {
    throw new TypeError('Invalid public token derivation input');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(derivationKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const message = encodeUtf8(
    `${PUBLIC_TOKEN_DOMAIN}\0${ownerUserId.toLowerCase()}\0${clientSessionId.toLowerCase()}`,
  );
  const ownedMessage = Uint8Array.from(message);
  const signature = await crypto.subtle.sign('HMAC', key, ownedMessage.buffer);
  const tokenBytes = new Uint8Array(signature);
  if (tokenBytes.byteLength !== PUBLIC_TOKEN_BYTES) {
    throw new Error('Derived public token has an invalid byte length');
  }
  const token = bytesToBase64Url(tokenBytes);

  if (!isPublicToken(token)) {
    throw new Error('Derived public token failed its invariant');
  }

  return token;
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const input = typeof value === 'string' ? encodeUtf8(value) : value;
  const owned = Uint8Array.from(input);
  const digest = await crypto.subtle.digest('SHA-256', owned.buffer);
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPublicToken(token: string): Promise<string> {
  if (!isPublicToken(token)) {
    throw new TypeError('Invalid public token');
  }

  return await sha256Hex(token);
}
