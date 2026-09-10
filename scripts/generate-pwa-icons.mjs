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

/**
 * LE MASKABLE EST UNE AUTRE IMAGE, PAS LA MÊME EN PLUS PETIT.
 *
 * Les deux PNG étaient déclarés `any maskable` : la même image servait au
 * navigateur, qui la montre telle quelle, et à Android, qui la rogne à son
 * masque. Or `logo.png` est une TUILE ARRONDIE posée sur un fond gris clair.
 * Rognée par le masque, elle perdait ses coins — et le fond clair formait un
 * liseré tout autour du vert.
 *
 * Deux gestes, et aucun ne redessine le logo :
 *
 *   1. LE FOND CLAIR EST REMPLACÉ PAR LA COULEUR DU BORD DE LA TUILE. On part
 *      des bords de l'image et on n'avance que sur des pixels clairs et peu
 *      saturés : le texte crème et les quilles, eux, sont ENFERMÉS dans le
 *      vert, donc jamais atteints. La couleur de remplissage n'est pas
 *      choisie à la main mais MESURÉE — c'est la moyenne des pixels de tuile
 *      qui touchent ce fond, donc exactement la teinte que le raccord doit
 *      avoir pour ne pas se voir.
 *   2. L'ILLUSTRATION EST RAMENÉE DANS LA ZONE DE SÉCURITÉ, le disque de 80 %
 *      de la toile. Le mot « MOLKKY » est ce qui s'en approche le plus : il
 *      atteignait le rayon 0,402 — dehors, de peu. À 88 % il tombe à 0,354.
 */
function renderMaskable(image, size) {
  const { width: w, height: h, data: d } = image;
  const lire = i => [d[i << 2], d[(i << 2) + 1], d[(i << 2) + 2]];
  const clair = i => {
    const [r, g, b] = lire(i);
    const max = Math.max(r, g, b);
    return max > 190 && max - Math.min(r, g, b) < 40;
  };

  // — le masque « dehors » : propagation depuis les bords, sur du clair
  const dehors = new Uint8Array(w * h);
  const file = [];
  const semer = i => {
    if (!dehors[i] && clair(i)) {
      dehors[i] = 1;
      file.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    semer(x);
    semer((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    semer(y * w);
    semer(y * w + w - 1);
  }
  for (let k = 0; k < file.length; k++) {
    const i = file[k];
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) semer(i - 1);
    if (x < w - 1) semer(i + 1);
    if (y > 0) semer(i - w);
    if (y < h - 1) semer(i + w);
  }

  // — la teinte du fond : le vert de la tuile, mesuré À L'INTÉRIEUR du bord.
  // Prendre les pixels qui TOUCHENT le fond clair donnait un vert sage
  // délavé : ce sont des pixels d'anti-crénelage, moitié vert moitié gris,
  // et la tuile ressortait alors comme un pavé plus sombre sur un fond plus
  // clair — le liseré qu'on voulait supprimer, en vert cette fois. On
  // échantillonne donc 2 % plus loin, et seulement sur la bande médiane, à
  // l'écart des coins arrondis.
  const inset = Math.round(w * 0.02);
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = Math.round(h * 0.2); y < Math.round(h * 0.8); y++) {
    let gauche = -1;
    let droite = -1;
    for (let x = 0; x < w; x++) {
      if (!dehors[y * w + x]) {
        if (gauche < 0) gauche = x;
        droite = x;
      }
    }
    if (gauche < 0 || droite - gauche < inset * 4) continue;
    for (const x of [gauche + inset, droite - inset]) {
      const [r, g, b] = lire(y * w + x);
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  const fond = n ? [sr / n, sg / n, sb / n].map(Math.round) : [45, 95, 62];

  // — l'illustration à 88 %, le pourtour de la même teinte
  const out = new PNG({ width: size, height: size });
  const od = out.data;
  const echelle = 0.88;
  const marge = (size * (1 - echelle)) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const oi = (y * size + x) << 2;
      const sx = Math.round(((x - marge) / (size * echelle)) * w);
      const sy = Math.round(((y - marge) / (size * echelle)) * h);
      const hors = sx < 0 || sy < 0 || sx >= w || sy >= h;
      const si = hors ? -1 : sy * w + sx;
      const c = hors || dehors[si] ? fond : lire(si);
      od[oi] = c[0];
      od[oi + 1] = c[1];
      od[oi + 2] = c[2];
      od[oi + 3] = 255;
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

await writeFile(
  join(outDir, 'icon-maskable.png'),
  PNG.sync.write(renderMaskable(src, 512))
);

console.log(
  'Icônes écrites dans public/icons/ (192, 512, apple-touch 180, logo 128, favicon 64, maskable 512).'
);
