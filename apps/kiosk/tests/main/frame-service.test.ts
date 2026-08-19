import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FRAME_SLOTS,
  FrameService,
  SUPPORTED_FRAME_ASPECT,
} from '../../src/main/frame/frame-service.js';
import type { ImageProcessor } from '../../src/main/image/image-worker-client.js';
import { createTestStore } from './helpers.js';

describe('frame import contract', () => {
  it('rejects a decoded transparent frame outside the supported portrait aspect', async () => {
    const store = createTestStore();
    const processor = fakeProcessor(1_000, 1_000);
    const service = new FrameService(store.repository, store.vault, 'unused.png', processor);
    try {
      await expect(
        service.importFrame('square', Buffer.from('png'), DEFAULT_FRAME_SLOTS),
      ).rejects.toThrow(/4:5 portrait/);
      expect(store.repository.getActiveFrame()).toBeNull();
    } finally {
      store.close();
    }
  });

  it('rejects the previously supported 3:2 landscape aspect', async () => {
    const store = createTestStore();
    const service = new FrameService(
      store.repository,
      store.vault,
      'unused.png',
      fakeProcessor(2_700, 1_800),
    );
    try {
      await expect(
        service.importFrame('landscape', Buffer.from('png'), DEFAULT_FRAME_SLOTS),
      ).rejects.toThrow(/4:5 portrait/);
    } finally {
      store.close();
    }
  });

  it('validates exactly four slots before persisting an accepted portrait frame', async () => {
    const store = createTestStore();
    const service = new FrameService(
      store.repository,
      store.vault,
      'unused.png',
      fakeProcessor(3_375, 4_219),
    );
    try {
      await expect(
        service.importFrame(
          'bad slots',
          Buffer.from('png'),
          DEFAULT_FRAME_SLOTS.slice(0, 3) as never,
        ),
      ).rejects.toThrow();
      const frame = await service.importFrame(
        'valid frame',
        Buffer.from('png'),
        DEFAULT_FRAME_SLOTS,
      );
      expect(frame.slots).toHaveLength(4);
      expect(frame.width / frame.height).toBeCloseTo(SUPPORTED_FRAME_ASPECT, 6);
    } finally {
      store.close();
    }
  });

  it('keeps every calibrated default slot inside the frame bounds', () => {
    for (const slot of DEFAULT_FRAME_SLOTS) {
      expect(slot.x + slot.width).toBeLessThanOrEqual(1);
      expect(slot.y + slot.height).toBeLessThanOrEqual(1);
    }
  });
});

function fakeProcessor(width: number, height: number): ImageProcessor {
  return {
    process: () => Promise.reject(new Error('not used')),
    validateSourceJpeg: () => Promise.reject(new Error('not used')),
    normalizeFramePng: () =>
      Promise.resolve({ bytes: Buffer.from('normalized transparent PNG'), width, height }),
    close: () => Promise.resolve(),
  };
}
