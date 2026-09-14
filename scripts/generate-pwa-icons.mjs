/**
 * Génère les PNG PWA à partir de public/logo.png (logo de marque haute résolution).
 * Exécuter : npm run icons
 *
 * SHARP PLUTÔT QUE PNGJS. Le dépôt portait DEUX bibliothèques d'images pour un
 * seul travail : `sharp`, exigé par `pwa-icons` du socle, et `pngjs`, que ce
 * script était seul à employer. L'en-tête d'alors s'en justifiait par « aucune
 * dépendance native » — ce qui a cessé d'être vrai le jour où le socle est
 * entré. Restait le coût : `pngjs` n'a plus rien publié depuis février 2023 et
 * figurait, à ce titre, parmi les librairies dormantes du parc.
 *
 * Le dessin, lui, ne change pas de main : la reprise du fond (plus bas) reste
 * du JavaScript sur les pixels bruts, faute de remplissage par propagation
 * dans sharp.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'public', 'logo.png');
const outDir = join(root, 'public', 'icons');

await mkdir(outDir, { recursive: true });

// `ensureAlpha` : le canal est ici une certitude, pas une supposition — la
// suite indexe les pixels par blocs de quatre octets.
const { data: src, info } = await sharp(await readFile(input))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const raw = { width: info.width, height: info.height, channels: 4 };

/**
 * Niveau 9 et filtrage adaptatif : les défauts de sharp (niveau 6, filtre
 * fixe) rendent des fichiers PLUS LOURDS que pngjs, qui compresse au maximum —
 * 312 ko pour le 512, là où pngjs en produit 275 des mêmes pixels. Ainsi
 * réglé, sharp repasse dessous, à 252.
 */
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: true };

/**
 * `lanczos3`, le noyau par défaut de sharp, à la place de la moyenne de blocs
 * qui tenait ici. Il rend le mot « MOLKKY » plus net aux petites tailles ;
 * l'écart moyen sur l'ancienne sortie est de 2 niveaux sur 255, donc invisible
 * ailleurs.
 */
const KERNEL = 'lanczos3';

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
function fondEtMasque() {
  const { width: w, height: h } = info;
  const lire = i => [src[i << 2], src[(i << 2) + 1], src[(i << 2) + 2]];
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
  return { dehors, fond };
}

async function renderMaskable(size) {
  const { dehors, fond } = fondEtMasque();

  // Le fond clair est repeint AVANT la réduction : repeindre après laisserait
  // sharp mélanger le gris au vert sur le pourtour, et le liseré reviendrait
  // par la petite porte.
  const repeint = Buffer.from(src);
  for (let i = 0; i < dehors.length; i++) {
    if (!dehors[i]) continue;
    const o = i << 2;
    repeint[o] = fond[0];
    repeint[o + 1] = fond[1];
    repeint[o + 2] = fond[2];
    repeint[o + 3] = 255;
  }

  const inner = Math.round(size * 0.88);
  const marge = Math.floor((size - inner) / 2);
  const background = { r: fond[0], g: fond[1], b: fond[2], alpha: 1 };
  return sharp(repeint, { raw })
    .resize(inner, inner, { kernel: KERNEL })
    .extend({
      top: marge,
      bottom: size - inner - marge,
      left: marge,
      right: size - inner - marge,
      background,
    })
    .png(PNG_OPTIONS)
    .toBuffer();
}

const sizes = [
  { w: 192, h: 192, name: 'icon-192.png' },
  { w: 512, h: 512, name: 'icon-512.png' },
  { w: 180, h: 180, name: 'apple-touch-icon.png' },
  { w: 128, h: 128, name: 'logo-128.png' },
  { w: 64, h: 64, name: 'favicon.png' },
];

for (const { w, h, name } of sizes) {
  await sharp(src, { raw })
    .resize(w, h, { kernel: KERNEL })
    .png(PNG_OPTIONS)
    .toFile(join(outDir, name));
}

await writeFile(join(outDir, 'icon-maskable.png'), await renderMaskable(512));

console.log(
  'Icônes écrites dans public/icons/ (192, 512, apple-touch 180, logo 128, favicon 64, maskable 512).'
);
