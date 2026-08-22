/** Verifies the two packaged anniversary frames and their three intended alpha windows. */
import { basename } from 'node:path';

import sharp from 'sharp';

const EXPECTED_WIDTH = 1200;
const EXPECTED_HEIGHT = 3600;
const TRANSPARENT_ALPHA_MAX = 8;
const MIN_WINDOW_PIXELS = 40_000;
const WINDOW_BOUND_TOLERANCE = 12;
const OPAQUE_SAMPLE_OFFSET = 16;
const EXPECTED_WINDOWS = {
  'mat-frame.png': [
    { minX: 300, minY: 1064, maxX: 945, maxY: 1577 },
    { minX: 166, minY: 1770, maxX: 829, maxY: 2301 },
    { minX: 326, minY: 2674, maxX: 883, maxY: 3129 },
  ],
  'anniv-frame.png': [
    { minX: 82, minY: 1008, maxX: 1113, maxY: 1605 },
    { minX: 78, minY: 1756, maxX: 1109, maxY: 2355 },
    { minX: 82, minY: 2508, maxX: 1113, maxY: 3107 },
  ],
};

const paths = process.argv.slice(2);
const frames =
  paths.length > 0 ? paths : ['resources/frames/mat-frame.png', 'resources/frames/anniv-frame.png'];

for (const path of frames) {
  await verifyFrame(path);
}

async function verifyFrame(path) {
  const metadata = await sharp(path).metadata();
  const stats = await sharp(path).stats();
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const failures = [];

  if (metadata.width !== EXPECTED_WIDTH || metadata.height !== EXPECTED_HEIGHT) {
    failures.push(`unexpected size ${metadata.width}x${metadata.height}`);
  }
  if (info.width * 3 !== info.height) failures.push('frame does not use a valid 1:3 aspect ratio');
  if (metadata.format !== 'png' || !metadata.hasAlpha) {
    failures.push('not a transparent PNG');
  }
  if ((stats.channels.at(-1)?.min ?? 255) > TRANSPARENT_ALPHA_MAX) {
    failures.push('frame has no fully transparent pixels');
  }

  const components = findTransparentComponents(data, info)
    .filter((component) => component.pixelCount >= MIN_WINDOW_PIXELS)
    .sort((left, right) => left.minY - right.minY);

  if (components.length !== 3) {
    failures.push(`expected 3 dominant transparent windows, found ${components.length}`);
  }

  const expectedWindows = EXPECTED_WINDOWS[basename(path)];
  if (!expectedWindows)
    failures.push(`no expected window geometry registered for ${basename(path)}`);

  for (const [index, component] of components.entries()) {
    const centerX = Math.floor((component.minX + component.maxX) / 2);
    const centerY = Math.floor((component.minY + component.maxY) / 2);
    const centerAlpha = alphaAt(data, info, centerY * info.width + centerX);
    if (centerAlpha > TRANSPARENT_ALPHA_MAX) {
      failures.push(`window ${index + 1} center is not transparent (alpha ${centerAlpha})`);
    }
    const expected = expectedWindows?.[index];
    if (expected) {
      for (const edge of ['minX', 'minY', 'maxX', 'maxY']) {
        if (Math.abs(component[edge] - expected[edge]) > WINDOW_BOUND_TOLERANCE) {
          failures.push(
            `window ${index + 1} ${edge} is ${component[edge]}, expected ${expected[edge]} ± ${WINDOW_BOUND_TOLERANCE}`,
          );
        }
      }
      const samples = [
        [centerX, expected.minY - OPAQUE_SAMPLE_OFFSET],
        [centerX, expected.maxY + OPAQUE_SAMPLE_OFFSET],
        [expected.minX - OPAQUE_SAMPLE_OFFSET, centerY],
        [expected.maxX + OPAQUE_SAMPLE_OFFSET, centerY],
      ];
      for (const [sampleX, sampleY] of samples) {
        if (sampleX < 0 || sampleX >= info.width || sampleY < 0 || sampleY >= info.height) continue;
        const sampleAlpha = alphaAt(data, info, sampleY * info.width + sampleX);
        if (sampleAlpha < 250) {
          failures.push(
            `window ${index + 1} artwork outside ${sampleX},${sampleY} is not opaque (alpha ${sampleAlpha})`,
          );
        }
      }
    }
  }

  const allowedWindows = components.map((component) => ({
    minX: Math.max(0, component.minX - 8),
    minY: Math.max(0, component.minY - 8),
    maxX: Math.min(info.width - 1, component.maxX + 8),
    maxY: Math.min(info.height - 1, component.maxY + 8),
  }));
  let unexpectedTransparentPixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const allowed = allowedWindows.some(
        (window) => x >= window.minX && x <= window.maxX && y >= window.minY && y <= window.maxY,
      );
      if (!allowed && alphaAt(data, info, y * info.width + x) < 250) {
        unexpectedTransparentPixels += 1;
      }
    }
  }
  if (unexpectedTransparentPixels > 0) {
    failures.push(`${unexpectedTransparentPixels} transparent pixels exist outside photo windows`);
  }

  if (failures.length > 0) {
    throw new Error(`${path} verification failed: ${failures.join('; ')}`);
  }

  process.stdout.write(
    `Verified ${path}: ${metadata.width}x${metadata.height}, three transparent photo windows, opaque artwork outside.\n`,
  );
}

function findTransparentComponents(data, info) {
  const seen = new Uint8Array(info.width * info.height);
  const components = [];

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const start = y * info.width + x;
      if (seen[start] || alphaAt(data, info, start) > TRANSPARENT_ALPHA_MAX) continue;
      const stack = [start];
      let pixelCount = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      seen[start] = 1;

      while (stack.length > 0) {
        const current = stack.pop();
        const currentX = current % info.width;
        const currentY = Math.floor(current / info.width);
        pixelCount += 1;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        for (const next of [current - 1, current + 1, current - info.width, current + info.width]) {
          if (next < 0 || next >= seen.length || seen[next]) continue;
          const nextX = next % info.width;
          const nextY = Math.floor(next / info.width);
          if (Math.abs(nextX - currentX) + Math.abs(nextY - currentY) !== 1) continue;
          if (alphaAt(data, info, next) <= TRANSPARENT_ALPHA_MAX) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }

      components.push({ pixelCount, minX, maxX, minY, maxY });
    }
  }

  return components;
}

function alphaAt(data, info, pixelIndex) {
  return data[pixelIndex * info.channels + 3];
}
