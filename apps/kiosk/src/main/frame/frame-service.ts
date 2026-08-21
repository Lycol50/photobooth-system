import { randomUUID } from 'node:crypto';
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

/**
 * Normalized photo slots calibrated against the transparent camera LCD cutouts in the default 3-strip frame.
 */
export const DEFAULT_FRAME_SLOTS: FrameLayout = FrameLayoutSchema.parse([
  {
    slotIndex: 1,
    name: 'Photo 1',
    x: 0.171667,
    y: 0.161667,
    width: 0.581667,
    height: 0.158056,
    cropMode: 'crop-to-fill',
  },
  {
    slotIndex: 2,
    name: 'Photo 2',
    x: 0.151667,
    y: 0.4225,
    width: 0.57,
    height: 0.151667,
    cropMode: 'crop-to-fill',
  },
  {
    slotIndex: 3,
    name: 'Photo 3',
    x: 0.258333,
    y: 0.713611,
    width: 0.5325,
    height: 0.144167,
    cropMode: 'crop-to-fill',
  },
]);

export const DEFAULT_FRAME_NAME = 'CCF Alabang Ministry Fair Strip';

export class FrameService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly vault: PhotoVault,
    private readonly defaultFramePath: string,
    private readonly imageProcessor: ImageProcessor,
  ) {}

  async ensureDefaultFrame(): Promise<StoredFrame> {
    const active = this.repository.getActiveFrame();
    const bytes = await readFile(this.defaultFramePath);
    if (active && !isSupersededDefault(active, bytes)) return active;
    return this.importFrame(DEFAULT_FRAME_NAME, bytes, DEFAULT_FRAME_SLOTS);
  }

  async importFrame(
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
      this.repository.addFrame(frame, validatedSlots);
    } catch (error) {
      this.vault.delete(stored.relativePath);
      throw error;
    }
    const saved = this.repository.getFrame(frame.id);
    if (!saved) throw new AppError('frame_missing', 'The frame could not be saved.');
    return saved;
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
 * An installation that already imported an earlier shipped default keeps using it forever, which
 * would leave it on a frame the current pipeline no longer supports. A stored default whose
 * dimensions no longer match the packaged artwork is replaced on the next start; operator-imported
 * frames are never touched.
 */
function isSupersededDefault(active: StoredFrame, defaultFrameBytes: Uint8Array): boolean {
  if (active.name !== DEFAULT_FRAME_NAME) return false;
  const size = readPngSize(defaultFrameBytes);
  if (!size) return false;
  return active.width !== size.width || active.height !== size.height;
}

function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 24) return null;
  if (PNG_MAGIC.some((value, index) => bytes[index] !== value)) return null;
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.readUInt32BE(16), height: view.readUInt32BE(20) };
}

function sanitizeFrameName(name: string): string {
  const trimmed = name.trim().replace(/\p{Cc}|[<>:"/\\|?*]/gu, '');
  return trimmed.slice(0, 120) || 'Grace Booth Frame';
}
