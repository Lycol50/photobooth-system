import { ApiError } from './errors.ts';

export type JpegDimensions = {
  width: number;
  height: number;
};

const START_OF_FRAME_MARKERS = new Set([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);

export function readJpegDimensions(bytes: Uint8Array): JpegDimensions | null {
  if (
    bytes.length < 4 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes.at(-2) !== 0xff ||
    bytes.at(-1) !== 0xd9
  ) {
    return null;
  }

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined) return null;

    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 1 >= bytes.length) return null;

    const segmentLength = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    if (START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) return null;
      const height = ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0);
      const width = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      return width > 0 && height > 0 ? { width, height } : null;
    }

    if (marker === 0xda) return null;
    offset += segmentLength;
  }

  return null;
}

export function assertExpectedJpeg(
  bytes: Uint8Array,
  expected: { byteSize: number; width: number; height: number },
): void {
  if (bytes.byteLength !== expected.byteSize) {
    throw new ApiError(422, 'conflict', 'The uploaded image size does not match the request.');
  }
  const dimensions = readJpegDimensions(bytes);
  if (!dimensions || dimensions.width !== expected.width || dimensions.height !== expected.height) {
    throw new ApiError(422, 'conflict', 'The uploaded image is not the expected JPEG.');
  }
}
