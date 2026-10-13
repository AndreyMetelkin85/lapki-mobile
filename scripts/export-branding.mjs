import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

// Сборка использует исходный утверждённый PNG целиком, без перерисовки фигур.
const root = new URL('../assets/branding/', import.meta.url);
const config = JSON.parse(
  await readFile(new URL('../app.json', import.meta.url), 'utf8'),
).expo;
const sourceName = basename(config.android?.icon ?? config.icon);
const approved = await readFile(new URL(sourceName, root));
const metadata = JSON.parse(
  await readFile(new URL('generation.json', root), 'utf8'),
);
const expected = metadata.assets.find(
  (asset) => asset.file === sourceName,
)?.sha256;
const actual = createHash('sha256').update(approved).digest('hex');
if (actual !== expected)
  throw new Error('Исходный значок отличается от утверждённого PNG.');

// Android показывает центральные 72 dp из слоя 108 dp. Эти поля компенсируют
// увеличение адаптивного слоя и сохраняют исходные размер и пропорции рисунка.
const canvas = 1024;
const side = canvas * (72 / 108);
const inset = (canvas - side) / 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}">
  <image href="data:image/png;base64,${approved.toString('base64')}"
    x="${inset}" y="${inset}" width="${side}" height="${side}"
    preserveAspectRatio="xMidYMid meet" />
</svg>`;
const image = new Resvg(svg, { font: { loadSystemFonts: false } }).render();
await writeFile(new URL('lapki-foreground.png', root), image.asPng());
console.log(
  `lapki-foreground.png: ${image.width} × ${image.height}; source ${sourceName}; SHA-256 ${actual}`,
);
