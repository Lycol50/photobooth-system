/**
 * Regenerates `resources/frames/default-frame.png` from the CCF Alabang 3-shot PhotoBooth artwork
 * by keying out the three camera LCD screen regions (#00FF00 green) into transparent alpha channels.
 *
 * Usage: node scripts/build-default-frame.mjs <source.jpg/png> [output.png]
 */
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

export const FRAME_WIDTH = 1200;
export const FRAME_HEIGHT = 3600;

/**
 * Normalized photo slot rectangles measured from the 3-shot CCF Alabang artwork.
 */
export const SLOT_RECTS_NORMALIZED = [
  { slotIndex: 1, name: 'Photo 1', x: 0.171667, y: 0.161667, width: 0.581667, height: 0.158056, cropMode: 'crop-to-fill' },
  { slotIndex: 2, name: 'Photo 2', x: 0.151667, y: 0.422500, width: 0.570000, height: 0.151667, cropMode: 'crop-to-fill' },
  { slotIndex: 3, name: 'Photo 3', x: 0.258333, y: 0.713611, width: 0.532500, height: 0.144167, cropMode: 'crop-to-fill' },
];

export async function buildDefaultFrame(sourcePath, outputPath) {
  const resized = await sharp(sourcePath)
    .resize(FRAME_WIDTH, FRAME_HEIGHT, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const { width, height, channels } = info;
  const rgba = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    // Chroma-key detection for the vibrant green screen:
    const isGreen = (g > 130 && g > r * 1.4 && g > b * 1.4) || (g > 180 && r < 120 && b < 120);

    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = isGreen ? 0 : 255;
  }

  await sharp(rgba, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(outputPath);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = process.argv[2] ?? 'C:/Users/padil/Downloads/fVYz9BIQ.jpg';
  const target = process.argv[3] ?? 'resources/frames/default-frame.png';
  await buildDefaultFrame(source, target);
  process.stdout.write(`default-frame.png (1200x3600 3-strip) generated from ${source}\n`);
}
