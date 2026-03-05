/**
 * Generate OG image (1200x630) matching the app's visual style.
 * Uses @napi-rs/canvas which is already available via pdf-parse dependency.
 *
 * Run: node scripts/generate-og-image.mjs
 */
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const W = 1200;
const H = 630;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// ── Background — warm off-white, matching app's light mode ──
ctx.fillStyle = '#faf8f5';
ctx.fillRect(0, 0, W, H);

// ── Open book — the main visual ──
const bookCx = W / 2;
const bookCy = 200;
drawOpenBook(ctx, bookCx, bookCy, 220, 'rgba(26,26,26,0.6)');

// ── Small chalice sitting on the book spine ──
const chaliceScale = 0.28;
ctx.save();
ctx.translate(bookCx - (82.5 * chaliceScale) / 2, bookCy - 95 - (226.25 * chaliceScale) / 2);
ctx.scale(chaliceScale, chaliceScale);
ctx.fillStyle = 'rgba(26,26,26,0.55)';
const chalicePath = new Path2D(
  'm 24,0 18,0 0,25 24,0 0,18 -24,0 0,18 c 6.34,0.05 12.68,-0.09 19.02,0.11 -0.06,1.57 -0.1,3.14 -0.31,4.69 -2.16,14.25 -4.11,28.56 -7.23,42.64 -2.54,7.95 -5.22,9.62 -9.44,17.21 0.29,11.03 2.3,21.97 4.41,32.79 1.46,4.01 2.75,8.31 5.78,11.46 2.22,2.39 4.49,4.72 6.72,7.1 0.02,1.34 0.05,2.67 0.07,4.01 L 5.05,181 c 0.04,-1.34 0.07,-2.68 0.11,-4.01 3.7,-4.31 8.65,-7.85 10.56,-13.42 2.55,-5.2 2.87,-11.06 4.14,-16.64 0.68,-7.1 2.34,-14.13 2.2,-21.29 -4.45,-9.46 -5.99,-18.77 -8.43,-30.82 C 12.05,82.92 9.76,72.08 8.98,61.09 c 6.35,-0.18 12.7,-0.05 19.06,-0.09 V 43 L 4,43 4,25 l 20,0 z'
);
ctx.fill(chalicePath);
ctx.restore();

// ── Title ──
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = 'rgba(26,26,26,0.85)';
ctx.font = '400 64px Georgia, "Times New Roman", serif';
drawSpacedText(ctx, 'ČTENÍ NA NEDĚLI', W / 2, 390, 8);

// ── Ornamental divider ──
const divY = 440;
ctx.strokeStyle = 'rgba(26,26,26,0.15)';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(W / 2 - 85, divY);
ctx.lineTo(W / 2 - 15, divY);
ctx.stroke();
ctx.beginPath();
ctx.moveTo(W / 2 + 15, divY);
ctx.lineTo(W / 2 + 85, divY);
ctx.stroke();
ctx.fillStyle = 'rgba(26,26,26,0.15)';
ctx.font = '12px Georgia';
ctx.fillText('✦', W / 2, divY + 1);

// ── Subtitle ──
ctx.fillStyle = 'rgba(26,26,26,0.45)';
ctx.font = '400 26px Georgia, "Times New Roman", serif';
drawSpacedText(ctx, 'CÍRKEV ČESKOSLOVENSKÁ HUSITSKÁ', W / 2, 490, 3);

// ── Domain ──
ctx.fillStyle = 'rgba(26,26,26,0.15)';
ctx.font = '18px Georgia, "Times New Roman", serif';
ctx.fillText('cteninanedeli.cz', W / 2, H - 40);

// ── Save ──
const pngBuffer = canvas.toBuffer('image/png');
const outPath = join(root, 'public', 'og-image.png');
writeFileSync(outPath, pngBuffer);
console.log(`OG image saved to ${outPath} (${pngBuffer.byteLength} bytes)`);

// ── Helpers ──

function drawSpacedText(ctx, text, x, y, spacing) {
  const chars = [...text];
  let totalWidth = 0;
  for (const ch of chars) {
    totalWidth += ctx.measureText(ch).width + spacing;
  }
  totalWidth -= spacing;
  let curX = x - totalWidth / 2;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, curX, y);
    curX += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = 'center';
}

function drawOpenBook(ctx, cx, cy, size, color) {
  const hw = size; // half-width of entire book
  const hh = size * 0.6; // half-height

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // Left page — slight curve outward
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh * 0.3); // top of spine
  ctx.bezierCurveTo(
    cx - hw * 0.3, cy - hh * 0.45,
    cx - hw * 0.7, cy - hh * 0.5,
    cx - hw, cy - hh * 0.25
  );
  ctx.lineTo(cx - hw, cy + hh * 0.55);
  ctx.bezierCurveTo(
    cx - hw * 0.7, cy + hh * 0.4,
    cx - hw * 0.3, cy + hh * 0.35,
    cx, cy + hh * 0.3 // bottom of spine
  );
  ctx.stroke();

  // Right page — mirror
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh * 0.3);
  ctx.bezierCurveTo(
    cx + hw * 0.3, cy - hh * 0.45,
    cx + hw * 0.7, cy - hh * 0.5,
    cx + hw, cy - hh * 0.25
  );
  ctx.lineTo(cx + hw, cy + hh * 0.55);
  ctx.bezierCurveTo(
    cx + hw * 0.7, cy + hh * 0.4,
    cx + hw * 0.3, cy + hh * 0.35,
    cx, cy + hh * 0.3
  );
  ctx.stroke();

  // Spine line
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh * 0.3);
  ctx.lineTo(cx, cy + hh * 0.3);
  ctx.stroke();

  // Text lines on left page
  ctx.globalAlpha = 0.1;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6;
    const ly = cy - hh * 0.15 + t * hh * 0.35;
    const lx1 = cx - hw * 0.85;
    const lx2 = cx - hw * 0.12;
    // Slight curve following the page shape
    ctx.beginPath();
    ctx.moveTo(lx1, ly + 3);
    ctx.quadraticCurveTo((lx1 + lx2) / 2, ly, lx2, ly + 2);
    ctx.stroke();
  }

  // Text lines on right page
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6;
    const ly = cy - hh * 0.15 + t * hh * 0.35;
    const lx1 = cx + hw * 0.12;
    const lx2 = cx + hw * 0.85;
    ctx.beginPath();
    ctx.moveTo(lx1, ly + 2);
    ctx.quadraticCurveTo((lx1 + lx2) / 2, ly, lx2, ly + 3);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
