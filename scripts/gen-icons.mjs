// Rasterise app/icon.svg vers les PNG PWA + apple-icon + favicon.ico, via le
// Chromium de Playwright (déjà installé). Source unique = app/icon.svg.
//   node scripts/gen-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const SVG = readFileSync('app/icon.svg', 'utf8');

const TARGETS = [
  { path: 'public/icons/icon-192.png', size: 192 },
  { path: 'public/icons/icon-256.png', size: 256 },
  { path: 'public/icons/icon-512.png', size: 512 },
  // Maskable = même mark (déjà dans la safe-zone centrale), fond full-bleed.
  { path: 'public/icons/icon-maskable-192.png', size: 192 },
  { path: 'public/icons/icon-maskable-512.png', size: 512 },
  // Apple touch icon (iOS arrondit lui-même → carré plein, pas de transparence).
  { path: 'app/apple-icon.png', size: 180 },
];

function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(1, 4); // 1 image
  const dir = Buffer.alloc(16);
  dir.writeUInt8(size >= 256 ? 0 : size, 0); // width
  dir.writeUInt8(size >= 256 ? 0 : size, 1); // height
  dir.writeUInt16LE(1, 4); // planes
  dir.writeUInt16LE(32, 6); // bpp
  dir.writeUInt32LE(png.length, 8);
  dir.writeUInt32LE(6 + 16, 12); // data offset
  return Buffer.concat([header, dir, png]);
}

async function render(page, size) {
  await page.setViewportSize({ width: size, height: size });
  const sized = SVG.replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(
    `<!doctype html><html><body style="margin:0;padding:0;line-height:0">${sized}</body></html>`,
    { waitUntil: 'networkidle' },
  );
  return page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const { path, size } of TARGETS) {
  const buf = await render(page, size);
  writeFileSync(path, buf);
  console.log(`✓ ${path} (${size}×${size}, ${buf.length} B)`);
}

// favicon.ico (PNG-in-ICO 48×48, supporté par tous les navigateurs modernes).
const ico48 = await render(page, 48);
writeFileSync('app/favicon.ico', pngToIco(ico48, 48));
console.log(`✓ app/favicon.ico (48×48 PNG-in-ICO, ${ico48.length} B payload)`);

await browser.close();
console.log('Terminé.');
