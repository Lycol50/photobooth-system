import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  isSafeSourceByteLength,
  isSafeSourceGeometry,
  validateSourceJpeg,
} from '../../src/main/image/image-validation.js';

describe('worker-side source image safety limits', () => {
  it('enforces the exact 50 MiB source boundary', () => {
    expect(isSafeSourceByteLength(50 * 1024 * 1024)).toBe(true);
    expect(isSafeSourceByteLength(50 * 1024 * 1024 + 1)).toBe(false);
  });

  it('enforces exact 80 MP, 12,000-edge, single-page, and four-channel geometry', () => {
    expect(isSafeSourceGeometry(10_000, 8_000, 1, 4)).toBe(true);
    expect(isSafeSourceGeometry(10_000, 8_001, 1, 4)).toBe(false);
    expect(isSafeSourceGeometry(12_000, 6_666, 1, 3)).toBe(true);
    expect(isSafeSourceGeometry(12_001, 1, 1, 3)).toBe(false);
    expect(isSafeSourceGeometry(1_000, 1_000, 2, 3)).toBe(false);
    expect(isSafeSourceGeometry(1_000, 1_000, 1, 5)).toBe(false);
  });

  it('fully decodes valid JPEGs and rejects corrupt JPEG payloads after metadata', async () => {
    const valid = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#3159b8' },
    })
      .jpeg()
      .toBuffer();
    await expect(validateSourceJpeg(valid)).resolves.toEqual({ width: 40, height: 30 });
    await expect(
      validateSourceJpeg(valid.subarray(0, Math.floor(valid.length / 2))),
    ).rejects.toThrow();
  });
});
