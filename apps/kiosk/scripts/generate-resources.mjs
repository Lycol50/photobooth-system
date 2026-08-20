import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const kioskRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const resourcesRoot = join(kioskRoot, 'resources');

const escapeXml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const saveSvgAsImage = async (relativePath, svg, options = {}) => {
  const target = join(resourcesRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  let pipeline = sharp(Buffer.from(svg));
  if (options.jpeg) {
    pipeline = pipeline.jpeg({ chromaSubsampling: '4:4:4', mozjpeg: true, quality: 92 });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, palette: false });
  }
  await pipeline.toFile(target);
};

const mockPhotoSvg = (index, palette, names) => {
  const [sky, floor, accent, deep, warm] = palette;
  const people = [
    [250, 545, 122, '#33415f'],
    [520, 500, 144, '#9b4b57'],
    [820, 535, 130, '#345a55'],
    [1110, 490, 150, '#66507a'],
    [1420, 550, 118, '#8c5b3b'],
  ]
    .map(
      ([x, y, radius, color], personIndex) => `
        <circle cx="${x}" cy="${Number(y) - Number(radius) - 88}" r="${Number(radius) * 0.36}" fill="#d9a47e"/>
        <path d="M ${Number(x) - Number(radius)} ${y} Q ${x} ${Number(y) - Number(radius) * 1.28} ${Number(x) + Number(radius)} ${y} L ${Number(x) + Number(radius) * 1.2} 1180 L ${Number(x) - Number(radius) * 1.2} 1180 Z" fill="${color}"/>
        <circle cx="${Number(x) + 42}" cy="${Number(y) - Number(radius) - 92}" r="7" fill="${personIndex % 2 === 0 ? deep : warm}"/>
      `,
    )
    .join('');
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 0 1800 1200">
      <defs>
        <linearGradient id="sky-${index}" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${sky}"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
        <radialGradient id="glow-${index}" cx=".5" cy=".16" r=".6">
          <stop stop-color="#fff" stop-opacity=".9"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1800" height="1200" fill="url(#sky-${index})"/>
      <rect width="1800" height="1200" fill="url(#glow-${index})"/>
      <path d="M0 535 Q420 430 900 535 T1800 535 V1200 H0Z" fill="${floor}"/>
      <path d="M130 610 Q360 420 570 610 M1220 605 Q1440 410 1670 605" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="28"/>
      ${people}
      <rect x="48" y="48" width="1704" height="1104" rx="48" fill="none" stroke="#fff" stroke-opacity=".72" stroke-width="10"/>
      <text x="96" y="108" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(names[index - 1])}</text>
    </svg>`;
};

const attractSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <defs>
      <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#03001c"/>
        <stop offset=".52" stop-color="#301e67"/>
        <stop offset="1" stop-color="#5b8fb9"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="1600" height="900" fill="url(#wash)"/>
    <circle cx="250" cy="190" r="220" fill="#b6eada" opacity=".35" filter="url(#soft)"/>
    <circle cx="1330" cy="210" r="250" fill="#5b8fb9" opacity=".4" filter="url(#soft)"/>
    <path d="M0 680 Q260 490 510 690 T1020 680 T1600 650 V900 H0Z" fill="#301e67" opacity=".42" filter="url(#soft)"/>
    <g opacity=".32">
      <circle cx="170" cy="620" r="76" fill="#03001c"/><path d="M40 900Q70 675 170 675T300 900Z" fill="#03001c"/>
      <circle cx="470" cy="590" r="86" fill="#301e67"/><path d="M320 900Q350 650 470 650T620 900Z" fill="#301e67"/>
      <circle cx="785" cy="640" r="72" fill="#5b8fb9"/><path d="M660 900Q690 700 785 700T920 900Z" fill="#5b8fb9"/>
      <circle cx="1120" cy="575" r="92" fill="#03001c"/><path d="M950 900Q985 645 1120 645T1290 900Z" fill="#03001c"/>
      <circle cx="1440" cy="630" r="74" fill="#301e67"/><path d="M1310 900Q1340 690 1440 690T1580 900Z" fill="#301e67"/>
    </g>
    <rect width="1600" height="900" fill="#b6eada" opacity=".12"/>
  </svg>`;

const recoverySvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
    <defs>
      <linearGradient id="recovery-sky" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#dceaf8"/>
        <stop offset="1" stop-color="#f7e6c6"/>
      </linearGradient>
      <linearGradient id="hill" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#607f83"/>
        <stop offset="1" stop-color="#2f5661"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#recovery-sky)"/>
    <circle cx="1260" cy="210" r="112" fill="#fff8dd" opacity=".88"/>
    <path d="M0 590 Q290 360 600 610 Q850 420 1090 590 Q1330 400 1600 560 V900 H0Z" fill="#8aa0a0"/>
    <path d="M0 700 Q340 500 740 715 Q1080 500 1600 670 V900 H0Z" fill="url(#hill)"/>
    <path d="M0 790 Q360 680 750 805 Q1180 655 1600 760 V900 H0Z" fill="#193f52"/>
    <path d="M330 795 Q395 570 450 795 M410 795 Q480 510 548 795 M1190 775 Q1250 575 1310 775" fill="none" stroke="#e3c990" stroke-width="9" opacity=".75"/>
  </svg>`;

const frameSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="2700" height="1800" viewBox="0 0 2700 1800">
    <rect x="18" y="18" width="2664" height="1764" rx="70" fill="none" stroke="#fffdf6" stroke-width="96"/>
    <rect x="66" y="66" width="2568" height="1668" rx="42" fill="none" stroke="#00327d" stroke-width="18"/>
    <path d="M114 290 H2586 M114 1510 H2586" stroke="#fffdf6" stroke-width="92"/>
    <path d="M114 290 H2586 M114 1510 H2586" stroke="#0047ab" stroke-width="8"/>
    <circle cx="250" cy="1625" r="44" fill="#0047ab"/>
    <path d="M250 1597v56M222 1625h56" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
    <text x="1350" y="1685" text-anchor="middle" fill="#00327d" font-family="Arial, sans-serif" font-size="76" font-weight="700" letter-spacing="4">GRACE BOOTH</text>
  </svg>`;

const createWave = ({ durationSeconds, frequency, gain, sampleRate = 44_100, noise = false }) => {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  let noiseState = 0x6d2b79f5;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const attack = Math.min(1, time / 0.01);
    const release = Math.min(1, (durationSeconds - time) / 0.06);
    noiseState ^= noiseState << 13;
    noiseState ^= noiseState >>> 17;
    noiseState ^= noiseState << 5;
    const random = ((noiseState >>> 0) / 0xffffffff) * 2 - 1;
    const signal = noise
      ? random * Math.exp(-time * 22)
      : Math.sin(2 * Math.PI * frequency * time) * Math.exp(-time * 3.2);
    const value = Math.max(-1, Math.min(1, signal * gain * attack * release));
    buffer.writeInt16LE(Math.round(value * 32_767), 44 + sampleIndex * 2);
  }
  return buffer;
};

const skipGeneratedBackground = async (relativePath, svg, options = {}) => {
  const target = join(resourcesRoot, relativePath);
  try {
    await access(target);
    console.log(`Keeping custom ${relativePath}`);
    return;
  } catch {
    await saveSvgAsImage(relativePath, svg, options);
  }
};

await skipGeneratedBackground('backgrounds/attract.jpg', attractSvg, { jpeg: true });
await saveSvgAsImage('backgrounds/recovery.jpg', recoverySvg, { jpeg: true });
await saveSvgAsImage('frames/default-frame.png', frameSvg);

const palettes = [
  ['#91b6d9', '#a9b5a3', '#dce8f4', '#00327d', '#b76b56'],
  ['#e6c8b2', '#9bad9e', '#f4e5d8', '#265875', '#8d4b5b'],
  ['#a8c9c2', '#c2ad8e', '#e5f0e8', '#254f5b', '#a35e45'],
  ['#b7b5d8', '#9da898', '#e8e2f3', '#324f78', '#a05b6a'],
];
const fixtureNames = [
  'Joyful gathering',
  'A shared smile',
  'Together in grace',
  'A bright celebration',
];
for (let fixtureIndex = 1; fixtureIndex <= 4; fixtureIndex += 1) {
  await saveSvgAsImage(
    `mock/photo-${fixtureIndex}.jpg`,
    mockPhotoSvg(fixtureIndex, palettes[fixtureIndex - 1], fixtureNames),
    { jpeg: true },
  );
}

await mkdir(join(resourcesRoot, 'audio'), { recursive: true });
await writeFile(
  join(resourcesRoot, 'audio', 'countdown.wav'),
  createWave({ durationSeconds: 0.18, frequency: 880, gain: 0.24 }),
);
await writeFile(
  join(resourcesRoot, 'audio', 'shutter.wav'),
  createWave({ durationSeconds: 0.24, frequency: 140, gain: 0.36, noise: true }),
);

console.log('Generated packaged Grace Booth fixtures, frame, backgrounds, and audio cues.');
