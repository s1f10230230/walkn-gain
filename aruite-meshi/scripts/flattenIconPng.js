/* eslint-disable no-console */
// Flatten PNG alpha onto a solid background to avoid "black icon background" in iOS notifications.
// Usage:
//   node scripts/flattenIconPng.js assets/icon.png "#F8F4E3"

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const filePath = process.argv[2];
const hex = (process.argv[3] || '#F8F4E3').trim();

if (!filePath) {
  console.error('Usage: node scripts/flattenIconPng.js <pngPath> [#RRGGBB]');
  process.exit(1);
}

const normalizeHex = (h) => {
  const v = h.startsWith('#') ? h.slice(1) : h;
  if (v.length !== 6) throw new Error(`Invalid color: ${h}`);
  return v.toUpperCase();
};

const h = normalizeHex(hex);
const bgR = parseInt(h.slice(0, 2), 16);
const bgG = parseInt(h.slice(2, 4), 16);
const bgB = parseInt(h.slice(4, 6), 16);

const abs = path.resolve(process.cwd(), filePath);
const input = fs.readFileSync(abs);
const png = PNG.sync.read(input);

let hadAlpha = false;
for (let i = 0; i < png.data.length; i += 4) {
  const a = png.data[i + 3];
  if (a !== 255) {
    hadAlpha = true;
    const alpha = a / 255;
    png.data[i + 0] = Math.round(png.data[i + 0] * alpha + bgR * (1 - alpha));
    png.data[i + 1] = Math.round(png.data[i + 1] * alpha + bgG * (1 - alpha));
    png.data[i + 2] = Math.round(png.data[i + 2] * alpha + bgB * (1 - alpha));
    png.data[i + 3] = 255;
  }
}

fs.writeFileSync(abs, PNG.sync.write(png));
console.log(`[flattenIconPng] wrote ${filePath} (hadAlpha=${hadAlpha}) bg=${hex}`);

