const textEncoder = new TextEncoder();

export function encodeUtf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function byteaToHex(value: string): string | null {
  const normalized = value.startsWith('\\x') ? value.slice(2) : value;
  return /^[a-f0-9]{64}$/i.test(normalized) ? normalized.toLowerCase() : null;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encodeUtf8(left);
  const rightBytes = encodeUtf8(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}
