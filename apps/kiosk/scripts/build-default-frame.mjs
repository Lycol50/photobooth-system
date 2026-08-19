/**
 * Regenerates `resources/frames/default-frame.png` from the source PhotoBooth artwork by punching
 * the four photo slots out to full transparency. The source design ships with opaque placeholder
 * illustrations in those slots, which would hide the guest photos the image pipeline composites
 * underneath the frame.
 *
 * Usage: node scripts/build-default-frame.mjs <source.png>
 */
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

export const FRAME_WIDTH = 3375;
export const FRAME_HEIGHT = 4219;
export const SLOT_CORNER_RADIUS = 60;

/** Photo slot rectangles measured from the source artwork, in frame pixels. */
export const SLOT_RECTS = [
  { x: 277, y: 739, width: 1373, height: 1211 },
  { x: 1718, y: 739, width: 1380, height: 1211 },
  { x: 277, y: 2052, width: 1373, height: 1213 },
  { x: 1718, y: 2052, width: 1380, height: 1213 },
];

function cutoutMask() {
  const rects = SLOT_RECTS.map((rect) => {
    const x = rect.x - 1;
    const y = rect.y - 1;
    const width = rect.width + 2;
    const height = rect.height + 2;
    const radius = SLOT_CORNER_RADIUS + 1;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#ffffff"/>`;
  }).join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME_WIDTH}" height="${FRAME_HEIGHT}">${rects}</svg>`,
  );
}

export async function buildDefaultFrame(sourcePath, outputPath) {
  const metadata = await sharp(sourcePath).metadata();
  if (metadata.width !== FRAME_WIDTH || metadata.height !== FRAME_HEIGHT) {
    throw new Error(
      `Source frame must be ${FRAME_WIDTH}x${FRAME_HEIGHT}, received ${metadata.width}x${metadata.height}`,
    );
  }
  await sharp(sourcePath)
    .ensureAlpha()
    .composite([{ input: cutoutMask(), blend: 'dest-out' }])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(outputPath);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = process.argv[2];
  if (!source) throw new Error('Pass the source PNG path');
  await buildDefaultFrame(source, 'resources/frames/default-frame.png');
  process.stdout.write('default-frame.png regenerated\n');
}
