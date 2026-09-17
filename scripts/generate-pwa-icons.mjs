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
 *
 * `palette` : AJOUTÉ POUR PAYER LE RECADRAGE. Détourée, la tuile occupe toute
 * la toile au lieu de 62 % : c'est autant d'illustration en plus à coder, et
 * le 512 passait de 252 à 337 Kio — 128 Kio de précache pour tout le monde.
 *
 * MESURÉ SUR CES IMAGES-CI, réglage par réglage, parce qu'un réglage PNG ne se
 * recopie pas d'un dessin à l'autre :
 *
 *   icon-512   337 → 137 Kio    écart moyen visible 0,90 / 255
 *   logo-128    33 →  13 Kio    écart moyen visible 1,20 / 255
 *
 * « Visible » veut dire : hors des pixels transparents, où la couleur ne veut
 * rien dire et où le quantificateur met ce qu'il veut. L'erreur brute y monte
 * à 224 sans que rien ne change à l'écran — c'est le chiffre qui trompe.
 *
 * `colours` n'est pas passé : sharp rend le même fichier de 256 à 64, son
 * quantificateur choisit seul.
 */
const PNG_OPTIONS = {
  compressionLevel: 9,
  adaptiveFiltering: true,
  palette: true,
};

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

/**
 * LA TUILE, DÉTOURÉE DE SON FOND BLANC.
 *
 * `logo.png` est une tuile arrondie posée sur un carré blanc opaque — c'est
 * très bien pour l'image de partage (`logoPath` du SEO), que les réseaux
 * posent sur des fonds quelconques. Mais les icônes en héritaient : sur le
 * vert sombre de l'application, la tuile s'affichait dans un cadre blanc.
 *
 * Deux gestes, et le dessin ne change pas :
 *
 *   1. LE FOND DEVIENT TRANSPARENT. Le masque `dehors` est celui du maskable,
 *      qui ne remonte que du clair depuis les bords : le crème du cadre
 *      intérieur et les quilles sont ENFERMÉS dans le vert, donc jamais
 *      atteints.
 *   2. LA FRANGE D'ANTI-CRÉNELAGE EST DÉMÉLANGÉE. Un pixel de bord vaut
 *      `C = a·F + (1−a)·blanc` : le rendre opaque laisserait un liseré pâle
 *      tout autour, exactement le défaut qu'on retire. On retrouve sa
 *      couverture réelle en défaisant le mélange, et on lui rend la teinte de
 *      la tuile.
 *
 * Puis on RECADRE sur la tuile : elle n'occupait que 61 % de la toile, donc
 * 44 px sur les 56 du bandeau d'accueil. Une fois le blanc parti, cette marge
 * n'est plus un cadre, c'est du vide.
 */
// Le balayage coûte 1,5 million de pixels : les deux rendus le partagent.
const { dehors, fond } = fondEtMasque();

function tuileDetouree() {
  const { width: w, height: h } = info;
  const out = Buffer.from(src);

  // Le canal rouge : c'est celui qui s'écarte le plus du blanc sur ce vert,
  // donc celui qui donne la couverture la plus fine.
  const ecart = 255 - fond[0] || 1;
  const estDehors = (x, y) =>
    x < 0 || y < 0 || x >= w || y >= h ? 1 : dehors[y * w + x];
  // Deux pixels de large : au-delà, la tuile est d'un vert plein et le calcul
  // rend `a = 1`, c'est-à-dire ne touche à rien.
  const auContact = (x, y) => {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (estDehors(x + dx, y + dy)) return true;
      }
    }
    return false;
  };

  for (let i = 0; i < dehors.length; i++) {
    const o = i << 2;
    if (dehors[i]) {
      out[o + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i / w) | 0;
    if (!auContact(x, y)) continue;
    const a = Math.max(0, Math.min(1, (255 - src[o]) / ecart));
    out[o] = fond[0];
    out[o + 1] = fond[1];
    out[o + 2] = fond[2];
    out[o + 3] = Math.round(a * 255);
  }

  // Boîte de la tuile, puis retour au carré : la tuile fait 992×1020, et
  // l'étirer pour remplir un carré la déformerait.
  let x0 = w;
  let x1 = -1;
  let y0 = h;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dehors[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const cote = Math.max(x1 - x0 + 1, y1 - y0 + 1);
  return sharp(out, { raw })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .extend({
      top: Math.floor((cote - (y1 - y0 + 1)) / 2),
      bottom: Math.ceil((cote - (y1 - y0 + 1)) / 2),
      left: Math.floor((cote - (x1 - x0 + 1)) / 2),
      right: Math.ceil((cote - (x1 - x0 + 1)) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png(PNG_OPTIONS)
    .toBuffer();
}

async function renderMaskable(size) {
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
  // `opaque` : iOS APLATIT SUR DU NOIR ce que l'apple-touch-icon laisse
  // transparent. Elle garde donc un fond — celui de la tuile, mesuré, pas
  // celui d'origine.
  { w: 180, h: 180, name: 'apple-touch-icon.png', opaque: true },
  { w: 128, h: 128, name: 'logo-128.png' },
  { w: 64, h: 64, name: 'favicon.png' },
];

const detouree = await tuileDetouree();

for (const { w, h, name, opaque } of sizes) {
  const image = sharp(detouree).resize(w, h, { kernel: KERNEL });
  if (opaque) {
    image.flatten({ background: { r: fond[0], g: fond[1], b: fond[2] } });
  }
  await image.png(PNG_OPTIONS).toFile(join(outDir, name));
}

await writeFile(join(outDir, 'icon-maskable.png'), await renderMaskable(512));

console.log(
  'Icônes écrites dans public/icons/ (192, 512, apple-touch 180, logo 128, favicon 64, maskable 512).'
);
