/**
 * generate-icons.mjs
 * Generates proper PNG icons from the CČSH chalice SVG.
 *
 * Usage: node scripts/generate-icons.mjs
 * Requires: sharp (npm install --save-dev sharp)
 *
 * Fixes:
 *   - public/pwa-icon-512.png was a JPEG file (despite .png extension)
 *   - public/pwa-icon-192.png was 1024×1024 (not 192×192)
 */

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Chalice path from src/assets/ccsh-chalice.svg
// Original path coords (before the 1.25× scale in the source SVG):
//   width ≈ 66 units, height ≈ 181 units
// For a 512×512 icon with ~15% padding on each side:
//   target height = 512 × 0.70 = 358px
//   scale = 358 / 181 = 1.978 → using 1.9 for comfortable breathing room
//   scaled width = 66 × 1.9 = 125.4, height = 181 × 1.9 = 343.9
//   x center = (512 - 125.4) / 2 = 193.3, y center = (512 - 343.9) / 2 = 84.1
const CHALICE_PATH = `m 24,0 18,0 0,25 24,0 0,18 -24,0 0,17.99 c 6.34,0.05 12.68,-0.09 19.02,0.11 -0.06,1.57 -0.1,3.14 -0.31,4.69 -2.16,14.25 -4.11,28.56 -7.23,42.64 -2.541155,7.94968 -5.221157,9.61908 -9.44,17.21 0.29,11.03 2.3,21.97 4.41,32.79 1.46,4.01 2.75,8.31 5.78,11.46 2.22,2.39 4.49,4.72 6.72,7.1 0.02,1.34 0.05,2.67 0.07,4.01 l -56.07,0 c 0.04,-1.34 0.07,-2.68 0.11,-4.01 3.7,-4.31 8.65,-7.85 10.56,-13.42 2.55,-5.2 2.87,-11.06 4.14,-16.64 0.68,-7.1 2.34,-14.13 2.2,-21.29 C 13.605962,115.18097 12.064082,105.87178 9.63,93.82 8.05,82.92 5.76,72.08 4.98,61.09 11.33,60.91 17.68,61.04 24.04,61 24.02,55 23.98,49 24,43 L 0,43 0,25 24,25 C 23.97,16.67 24.01,8.33 24,0 m 5,7 c -0.01,8 0.01,16 0,24 L 5,31 c 0,2.34 0.01,4.68 0,7.02 8,0.05 15.99,-0.14 23.99,0.12 0.03,22.29 0,44.57 0.01,66.86 l 8,0 C 37.02,82.7 36.97,60.4 37.02,38.1 44.68,37.99 52.34,38 60,38.03 L 60,31 C 52.33,30.99 44.66,31.01 37,31 36.99,23 37.01,15 37,7 L 29,7 M 10.9,67 c 1.24,11.62 3.72,23.09 5.64,34.61 3.224275,8.9982 3.171015,17.1339 15.773858,18.41152 7.910147,-0.0315 12.246637,-3.01009 14.716142,-9.89152 1.26,-4.38 2.72,-8.71 3.3,-13.25 1.54,-9.96 3.81,-19.84 4.77,-29.88 -4.38,-0.12 -8.75,0.05 -13.12,-0.04 -0.04,13.99 0.1,27.99 -0.04,41.99 -5.96,0.09 -11.92,0.08 -17.88,0 -0.14,-14 0.01,-27.99 -0.03,-41.99 C 19.65,67.04 15.28,66.88 10.9,67 m 16.23,57.93 c -1.65,13.28 -2.97,26.65 -6.29,39.65 -2.17,4.23 -4.97,8.05 -8.17,11.57 l 40.67,0 c -3.22,-3.51 -6.01,-7.34 -8.18,-11.58 -3.33,-13 -4.64,-26.36 -6.29,-39.64 -3.91,-0.14 -7.83,-0.14 -11.74,0 z`;

// Master icon SVG: dark navy background with white chalice
// The rx="80" gives rounded corners (proportional to icon size)
const ICON_SVG_512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1a2332"/>
  <g transform="translate(193, 84) scale(1.9)" fill="white">
    <path d="${CHALICE_PATH}"/>
  </g>
</svg>`;

async function generateIcons() {
  console.log('Generating PWA icons from CČSH chalice SVG...');

  const svgBuffer = Buffer.from(ICON_SVG_512);

  // 512×512 PNG
  const out512 = join(publicDir, 'pwa-icon-512.png');
  await sharp(svgBuffer).resize(512, 512).png({ compressionLevel: 9 }).toFile(out512);
  console.log(`✓ Generated pwa-icon-512.png (512×512 PNG)`);

  // 192×192 PNG
  const out192 = join(publicDir, 'pwa-icon-192.png');
  await sharp(svgBuffer).resize(192, 192).png({ compressionLevel: 9 }).toFile(out192);
  console.log(`✓ Generated pwa-icon-192.png (192×192 PNG)`);

  console.log('\nDone! Verify with: file public/pwa-icon-512.png public/pwa-icon-192.png');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err.message);
  process.exit(1);
});
