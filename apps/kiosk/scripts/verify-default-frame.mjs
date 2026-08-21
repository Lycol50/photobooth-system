/**
 * Verifies the generated default frame: correct size, real transparency inside every photo slot,
 * and opaque artwork immediately outside the slots.
 */
import sharp from 'sharp';

import { FRAME_HEIGHT, FRAME_WIDTH, SLOT_RECTS_NORMALIZED } from './build-default-frame.mjs';

const path = process.argv[2] ?? 'resources/frames/default-frame.png';
const metadata = await sharp(path).metadata();
const stats = await sharp(path).stats();
const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];

const failures = [];
if (metadata.width !== FRAME_WIDTH || metadata.height !== FRAME_HEIGHT) {
  failures.push(`unexpected size ${metadata.width}x${metadata.height}`);
}
if (metadata.format !== 'png' || !metadata.hasAlpha) failures.push('not a transparent PNG');
if ((stats.channels.at(-1)?.min ?? 255) !== 0) failures.push('no fully transparent pixels');

for (const [index, slot] of SLOT_RECTS_NORMALIZED.entries()) {
  const rect = {
    x: Math.round(slot.x * info.width),
    y: Math.round(slot.y * info.height),
    width: Math.round(slot.width * info.width),
    height: Math.round(slot.height * info.height),
  };
  const centerX = rect.x + Math.floor(rect.width / 2);
  const centerY = rect.y + Math.floor(rect.height / 2);
  const samples = {
    center: alphaAt(centerX, centerY),
    innerTop: alphaAt(centerX, rect.y + 60),
    innerBottom: alphaAt(centerX, rect.y + rect.height - 60),
    innerLeft: alphaAt(rect.x + 60, centerY),
    innerRight: alphaAt(rect.x + rect.width - 60, centerY),
  };
  for (const [label, value] of Object.entries(samples)) {
    if (value !== 0) failures.push(`slot ${index + 1} ${label} alpha ${value}, expected 0`);
  }
  const outside = alphaAt(Math.max(0, rect.x - 30), centerY);
  if (outside !== 255) failures.push(`slot ${index + 1} surround alpha ${outside}, expected 255`);
  process.stdout.write(`slot ${index + 1}: ${JSON.stringify({ ...rect, ...samples, outside })}\n`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(
  `OK ${metadata.width}x${metadata.height} aspect ${FRAME_WIDTH / FRAME_HEIGHT}\n`,
);

