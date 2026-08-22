import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ANNIVERSARY_FRAME_NAME,
  ANNIVERSARY_FRAME_SLOTS,
  DEFAULT_FRAME_SLOTS,
  FrameService,
  MAT_FRAME_SLOTS,
  MAT_FRAME_NAME,
  SUPPORTED_FRAME_ASPECT,
} from '../../src/main/frame/frame-service.js';
import type { ImageProcessor } from '../../src/main/image/image-worker-client.js';
import { createTestStore } from './helpers.js';

const UNUSED_PACKAGED_FRAMES = { option1: 'unused-1.png', option2: 'unused-2.png' };
const PACKAGED_FRAMES = {
  option1: fileURLToPath(new URL('../../resources/frames/mat-frame.png', import.meta.url)),
  option2: fileURLToPath(new URL('../../resources/frames/anniv-frame.png', import.meta.url)),
};
const LEGACY_FRAME_PATH = fileURLToPath(
  new URL('../../resources/frames/default-frame.png', import.meta.url),
);

describe('frame import contract', () => {
  it('rejects a decoded transparent frame outside the supported portrait aspect', async () => {
    const store = createTestStore();
    const processor = fakeProcessor(1_000, 1_000);
    const service = new FrameService(
      store.repository,
      store.vault,
      UNUSED_PACKAGED_FRAMES,
      processor,
    );
    try {
      await expect(
        service.importFrame('square', Buffer.from('png'), DEFAULT_FRAME_SLOTS),
      ).rejects.toThrow(/1:3 vertical photobooth strip/);
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
      UNUSED_PACKAGED_FRAMES,
      fakeProcessor(2_700, 1_800),
    );
    try {
      await expect(
        service.importFrame('landscape', Buffer.from('png'), DEFAULT_FRAME_SLOTS),
      ).rejects.toThrow(/1:3 vertical photobooth strip/);
    } finally {
      store.close();
    }
  });

  it('validates exactly three slots before persisting an accepted strip frame', async () => {
    const store = createTestStore();
    const service = new FrameService(
      store.repository,
      store.vault,
      UNUSED_PACKAGED_FRAMES,
      fakeProcessor(1_200, 3_600),
    );
    try {
      await expect(
        service.importFrame(
          'bad slots',
          Buffer.from('png'),
          DEFAULT_FRAME_SLOTS.slice(0, 2) as never,
        ),
      ).rejects.toThrow();
      const frame = await service.importFrame(
        'valid frame',
        Buffer.from('png'),
        DEFAULT_FRAME_SLOTS,
      );
      expect(frame.slots).toHaveLength(3);
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

  it('supports two independently configurable collage options', async () => {
    const store = createTestStore();
    const service = new FrameService(
      store.repository,
      store.vault,
      UNUSED_PACKAGED_FRAMES,
      fakeProcessor(1_200, 3_600),
    );
    try {
      const frame1 = await service.importFrameForOption(1, 'Collage 1', Buffer.from('png1'));
      const frame2 = await service.importFrameForOption(2, 'Collage 2', Buffer.from('png2'));

      expect(frame1.id).not.toBe(frame2.id);
      expect(frame1.name).toBe('Collage 1');
      expect(frame2.name).toBe('Collage 2');

      const options = service.getFrameOptions();
      expect(options[0]?.id).toBe(frame1.id);
      expect(options[1]?.id).toBe(frame2.id);

      const slot0 = DEFAULT_FRAME_SLOTS[0]!;
      const slot1 = DEFAULT_FRAME_SLOTS[1]!;
      const slot2 = DEFAULT_FRAME_SLOTS[2]!;
      const updatedSlots = [{ ...slot0, x: 0.2 }, slot1, slot2];
      service.updateLayout(frame2.id, updatedSlots, frame2.revision);

      const reloadedFrame1 = store.repository.getFrame(frame1.id);
      const reloadedFrame2 = store.repository.getFrame(frame2.id);

      expect(reloadedFrame1?.slots[0]?.x).toBe(slot0.x);
      expect(reloadedFrame2?.slots[0]?.x).toBe(0.2);
    } finally {
      store.close();
    }
  });

  it('initializes fresh installations with the two packaged anniversary frames', async () => {
    const store = createTestStore();
    const service = new FrameService(
      store.repository,
      store.vault,
      PACKAGED_FRAMES,
      passthroughProcessor(),
    );
    try {
      const defaults = await service.ensureDefaultFrames();

      expect(defaults.option1.name).toBe(MAT_FRAME_NAME);
      expect(defaults.option1.slots).toEqual(MAT_FRAME_SLOTS);
      expect(defaults.option2.name).toBe(ANNIVERSARY_FRAME_NAME);
      expect(defaults.option2.slots).toEqual(ANNIVERSARY_FRAME_SLOTS);
      expect(defaults.option1.sha256).not.toBe(defaults.option2.sha256);
    } finally {
      store.close();
    }
  });

  it('upgrades untouched shipped legacy defaults to the two anniversary frames', async () => {
    const store = createTestStore();
    const processor = passthroughProcessor();
    const service = new FrameService(store.repository, store.vault, PACKAGED_FRAMES, processor);
    try {
      const legacyBytes = readFileSync(LEGACY_FRAME_PATH);
      const legacy1 = await service.importFrameForOption(
        1,
        'CCF Alabang Ministry Fair Strip',
        legacyBytes,
      );
      const legacy2 = await service.importFrameForOption(
        2,
        'CCF Alabang Ministry Fair Strip (Collage 2)',
        legacyBytes,
      );

      const defaults = await service.ensureDefaultFrames();

      expect(defaults.option1.id).not.toBe(legacy1.id);
      expect(defaults.option2.id).not.toBe(legacy2.id);
      expect(defaults.option1.name).toBe(MAT_FRAME_NAME);
      expect(defaults.option2.name).toBe(ANNIVERSARY_FRAME_NAME);
    } finally {
      store.close();
    }
  });

  it('preserves operator-imported artwork even when it uses a legacy-looking name', async () => {
    const store = createTestStore();
    const service = new FrameService(
      store.repository,
      store.vault,
      PACKAGED_FRAMES,
      passthroughProcessor(),
    );
    try {
      const custom1 = await service.importFrameForOption(
        1,
        'CCF Alabang Ministry Fair Strip',
        Buffer.from('operator artwork one'),
      );
      const custom2 = await service.importFrameForOption(
        2,
        'Operator anniversary artwork',
        Buffer.from('operator artwork two'),
        ANNIVERSARY_FRAME_SLOTS,
      );

      const defaults = await service.ensureDefaultFrames();

      expect(defaults.option1.id).toBe(custom1.id);
      expect(defaults.option2.id).toBe(custom2.id);
    } finally {
      store.close();
    }
  });

  it('preserves edited slot geometry on a formerly shipped default', async () => {
    const store = createTestStore();
    const service = new FrameService(
      store.repository,
      store.vault,
      PACKAGED_FRAMES,
      passthroughProcessor(),
    );
    try {
      const legacy = await service.importFrameForOption(
        1,
        'CCF Alabang Ministry Fair Strip',
        readFileSync(LEGACY_FRAME_PATH),
      );
      const editedSlots = legacy.slots.map((slot, index) =>
        index === 0 ? { ...slot, x: slot.x + 0.01 } : slot,
      );
      const edited = service.updateLayout(legacy.id, editedSlots, legacy.revision);

      const defaults = await service.ensureDefaultFrames();

      expect(defaults.option1.id).toBe(edited.id);
      expect(defaults.option1.revision).toBe(1);
      expect(defaults.option1.slots[0]?.x).toBeCloseTo(editedSlots[0]!.x);
      expect(defaults.option2.name).toBe(ANNIVERSARY_FRAME_NAME);
    } finally {
      store.close();
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

function passthroughProcessor(): ImageProcessor {
  return {
    process: () => Promise.reject(new Error('not used')),
    validateSourceJpeg: () => Promise.reject(new Error('not used')),
    normalizeFramePng: (bytes) =>
      Promise.resolve({ bytes: Buffer.from(bytes), width: 1_200, height: 3_600 }),
    close: () => Promise.resolve(),
  };
}
