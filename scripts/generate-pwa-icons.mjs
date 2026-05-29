/**
 * Génère les PNG PWA à partir de public/logo.png (logo de marque haute résolution).
 * Réduction par moyenne de blocs (box filter) avec pré-multiplication alpha
 * pour un rendu net sans dépendance native.
 * Exécuter : npm run icons
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'public', 'logo.png');
const outDir = join(root, 'public', 'icons');

await mkdir(outDir, { recursive: true });
const src = PNG.sync.read(await readFile(input));

/** Réduction box-filter sur canal alpha pré-multiplié. */
function resize(image, dstW, dstH) {
  const { width: sw, height: sh, data: sd } = image;
  const out = new PNG({ width: dstW, height: dstH });
  const od = out.data;

  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor((dy * sh) / dstH);
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * sh) / dstH));
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor((dx * sw) / dstW);
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * sw) / dstW));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * sw + sx) << 2;
          const sa = sd[i + 3] / 255;
          r += sd[i] * sa;
          g += sd[i + 1] * sa;
          b += sd[i + 2] * sa;
          a += sd[i + 3];
          n++;
        }
      }

      const alpha = a / n;
      const o = (dy * dstW + dx) << 2;
      if (alpha === 0) {
        od[o] = od[o + 1] = od[o + 2] = od[o + 3] = 0;
      } else {
        const sumA = a / 255;
        od[o] = Math.round(r / sumA);
        od[o + 1] = Math.round(g / sumA);
        od[o + 2] = Math.round(b / sumA);
        od[o + 3] = Math.round(alpha);
      }
    }
  }
  return out;
}

const sizes = [
  { w: 192, h: 192, name: 'icon-192.png' },
  { w: 512, h: 512, name: 'icon-512.png' },
  { w: 180, h: 180, name: 'apple-touch-icon.png' },
  { w: 128, h: 128, name: 'logo-128.png' },
  { w: 64, h: 64, name: 'favicon.png' },
];

for (const { w, h, name } of sizes) {
  const resized = resize(src, w, h);
  await writeFile(join(outDir, name), PNG.sync.write(resized));
}

console.log(
  'Icônes écrites dans public/icons/ (192, 512, apple-touch 180, logo 128, favicon 64).'
);
