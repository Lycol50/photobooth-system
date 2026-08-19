import { assertEquals } from 'jsr:@std/assert@1.0.14';
import { readJpegDimensions } from '../_shared/jpeg.ts';

function minimalJpeg(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xd9,
  ]);
}

Deno.test('readJpegDimensions reads a valid SOF segment', () => {
  assertEquals(readJpegDimensions(minimalJpeg(2800, 1800)), { width: 2800, height: 1800 });
});

Deno.test('readJpegDimensions rejects truncated and non-JPEG data', () => {
  assertEquals(readJpegDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), null);
  assertEquals(readJpegDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null);
});
