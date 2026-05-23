/**
 * Génère les PNG PWA à partir de public/logo.svg
 * Exécuter : npm run icons
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'public', 'logo.svg');
const outDir = join(root, 'public', 'icons');

await mkdir(outDir, { recursive: true });
const svg = await readFile(input);

const sizes = [
  { w: 192, h: 192, name: 'icon-192.png' },
  { w: 512, h: 512, name: 'icon-512.png' },
  { w: 180, h: 180, name: 'apple-touch-icon.png' },
];

for (const { w, h, name } of sizes) {
  await sharp(svg, { density: 384 })
    .resize(w, h, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(join(outDir, name));
}

console.log('Icônes écrites dans public/icons/ (192, 512, apple-touch 180).');
