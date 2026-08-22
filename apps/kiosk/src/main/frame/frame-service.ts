import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { FrameLayout, FrameSummary } from '@grace-booth/shared';
import { FrameLayoutSchema } from '@grace-booth/shared';

import type { LocalRepository, StoredFrame } from '../database/repositories.js';
import { AppError } from '../errors.js';
import type { ImageProcessor } from '../image/image-worker-client.js';
import type { PhotoVault } from '../storage/photo-vault.js';

/** 1:3 Vertical photobooth strip aspect of the CCF Alabang Ministry Fair frame (1200 x 3600 pixels). */
export const SUPPORTED_FRAME_ASPECT = 1 / 3;
const FRAME_ASPECT_TOLERANCE = 0.02;
const LEGACY_MINISTRY_FAIR_FRAME_SHA256 =
  'a0a3dfacd86a4a458e1cf510b4a19a395cdafc1c2373863adac083b79603a2eb';

/**
 * Normalized photo slots calibrated against the transparent camera LCD cutouts in the default 3-strip frame.
 */
export const MAT_FRAME_SLOTS: FrameLayout = FrameLayoutSchema.parse([
  {
    slotIndex: 1,
    name: 'Photo 1',
    x: 0.25,
    y: 0.295556,
    width: 0.538333,
    height: 0.142778,
    cropMode: 'crop-to-fill',
  },
  {
    slotIndex: 2,
    name: 'Photo 2',
    x: 0.138333,
    y: 0.491667,
    width: 0.553333,
    height: 0.147778,
    cropMode: 'crop-to-fill',
  },
  {
    slotIndex: 3,
    name: 'Photo 3',
    x: 0.271667,
    y: 0.742778,
    width: 0.465,
    height: 0.126667,
    cropMode: 'crop-to-fill',
  },
]);

export const ANNIVERSARY_FRAME_SLOTS: FrameLayout = FrameLayoutSchema.parse([
  {
    slotIndex: 1,
    name: 'Photo 1',
    x: 0.068333,
    y: 0.28,
    width: 0.86,
    height: 0.166111,
    cropMode: 'crop-to-fill',
  },
  {
    slotIndex: 2,
    name: 'Photo 2',
    x: 0.065,
    y: 0.487778,
    width: 0.86,
    height: 0.166667,
    cropMode: 'crop-to-fill',
  },
  {
    slotIndex: 3,
    name: 'Photo 3',
    x: 0.068333,
    y: 0.696667,
    width: 0.86,
    height: 0.166667,
    cropMode: 'crop-to-fill',
  },
]);

export const DEFAULT_FRAME_SLOTS = MAT_FRAME_SLOTS;
export const MAT_FRAME_NAME = 'M.A.T. 42nd Anniversary';
export const ANNIVERSARY_FRAME_NAME = 'CCF Alabang 42nd Anniversary';
export const DEFAULT_FRAME_NAME = MAT_FRAME_NAME;

type PackagedFramePaths = {
  option1: string;
  option2: string;
};

type PackagedFrameDefinition = {
  name: string;
  path: string;
  slots: FrameLayout;
};

export class FrameService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly vault: PhotoVault,
    private readonly packagedFramePaths: PackagedFramePaths,
    private readonly imageProcessor: ImageProcessor,
  ) {}

  async ensureDefaultFrames(): Promise<{ option1: StoredFrame; option2: StoredFrame }> {
    const existingOptions = this.repository.getFrameOptions();
    const definitions: [PackagedFrameDefinition, PackagedFrameDefinition] = [
      {
        name: MAT_FRAME_NAME,
        path: this.packagedFramePaths.option1,
        slots: MAT_FRAME_SLOTS,
      },
      {
        name: ANNIVERSARY_FRAME_NAME,
        path: this.packagedFramePaths.option2,
        slots: ANNIVERSARY_FRAME_SLOTS,
      },
    ];
    const [option1Bytes, option2Bytes] = await Promise.all([
      readFile(definitions[0].path),
      readFile(definitions[1].path),
    ]);
    const option1 = await this.ensurePackagedOption(
      1,
      existingOptions[0],
      definitions[0],
      option1Bytes,
      existingOptions,
    );
    const option2 = await this.ensurePackagedOption(
      2,
      existingOptions[1],
      definitions[1],
      option2Bytes,
      existingOptions,
    );
    return { option1, option2 };
  }

  async ensureDefaultFrame(): Promise<StoredFrame> {
    const { option1 } = await this.ensureDefaultFrames();
    return option1;
  }

  async importFrame(
    name: string,
    bytes: Uint8Array,
    slots: FrameLayout = DEFAULT_FRAME_SLOTS,
  ): Promise<StoredFrame> {
    return this.importFrameForOption(1, name, bytes, slots);
  }

  async importFrameForOption(
    optionIndex: 1 | 2,
    name: string,
    bytes: Uint8Array,
    slots: FrameLayout = DEFAULT_FRAME_SLOTS,
  ): Promise<StoredFrame> {
    const validatedSlots = FrameLayoutSchema.parse(slots);
    const normalized = await this.imageProcessor.normalizeFramePng(bytes);
    const aspect = normalized.width / normalized.height;
    if (Math.abs(aspect - SUPPORTED_FRAME_ASPECT) > FRAME_ASPECT_TOLERANCE) {
      throw new AppError(
        'frame_aspect',
        'The frame must use the supported 1:3 vertical photobooth strip aspect.',
      );
    }
    const stored = this.vault.write('frames', normalized.bytes);
    const now = Date.now();
    const frame: Omit<StoredFrame, 'slots'> = {
      id: randomUUID(),
      name: sanitizeFrameName(name),
      encryptedPath: stored.relativePath,
      width: normalized.width,
      height: normalized.height,
      byteSize: stored.byteSize,
      sha256: stored.sha256,
      revision: 0,
      createdAt: now,
      updatedAt: now,
    };
    try {
      this.repository.addFrame(frame, validatedSlots, optionIndex);
    } catch (error) {
      this.vault.delete(stored.relativePath);
      throw error;
    }
    const saved = this.repository.getFrame(frame.id);
    if (!saved) throw new AppError('frame_missing', 'The frame could not be saved.');
    return saved;
  }

  getFrameOptions(): [StoredFrame | null, StoredFrame | null] {
    return this.repository.getFrameOptions();
  }

  private async ensurePackagedOption(
    optionIndex: 1 | 2,
    existing: StoredFrame | null,
    definition: PackagedFrameDefinition,
    bytes: Uint8Array,
    existingOptions: [StoredFrame | null, StoredFrame | null],
  ): Promise<StoredFrame> {
    if (existing && !isReplaceablePackagedDefault(optionIndex, existing, bytes, existingOptions)) {
      return existing;
    }
    return this.importFrameForOption(optionIndex, definition.name, bytes, definition.slots);
  }

  updateLayout(frameId: string, slots: FrameLayout, expectedRevision: number): StoredFrame {
    return this.repository.updateFrameLayout(
      frameId,
      FrameLayoutSchema.parse(slots),
      expectedRevision,
    );
  }

  toSummary(frame: StoredFrame): FrameSummary {
    return {
      id: frame.id,
      name: frame.name,
      width: frame.width,
      height: frame.height,
      byteSize: frame.byteSize,
      mediaUrl: `grace-booth-media://asset/${frame.id}`,
      slots: frame.slots,
      revision: frame.revision,
    };
  }
}

/**
 * Replace only untouched, automatically supplied defaults. Operator imports and any frame whose
 * slot layout has been edited (revision > 0) are preserved across packaged artwork updates.
 */
function isReplaceablePackagedDefault(
  optionIndex: 1 | 2,
  frame: StoredFrame,
  packagedBytes: Uint8Array,
  existingOptions: [StoredFrame | null, StoredFrame | null],
): boolean {
  if (frame.revision > 0) return false;
  const packagedSha256 = createHash('sha256').update(packagedBytes).digest('hex');
  if (frame.sha256 === packagedSha256) return false;

  if (optionIndex === 1) {
    return (
      frame.name === 'CCF Alabang Ministry Fair Strip' &&
      frame.sha256 === LEGACY_MINISTRY_FAIR_FRAME_SHA256
    );
  }

  const option1 = existingOptions[0];
  const isLegacyNamedDefault =
    frame.name === 'CCF Alabang Ministry Fair Strip (Collage 2)' &&
    frame.sha256 === LEGACY_MINISTRY_FAIR_FRAME_SHA256;
  const isAutomaticDuplicate =
    option1 !== null &&
    frame.name === `${option1.name} (Collage 2)` &&
    frame.sha256 === option1.sha256;
  return isLegacyNamedDefault || isAutomaticDuplicate;
}

function sanitizeFrameName(name: string): string {
  const trimmed = name.trim().replace(/\p{Cc}|[<>:"/\\|?*]/gu, '');
  return trimmed.slice(0, 120) || 'Grace Booth Frame';
}
