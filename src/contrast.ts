/**
 * L'ENCRE LISIBLE SUR LA COULEUR D'UN JOUEUR.
 *
 * La pastille d'un joueur est peinte dans SA couleur — choisie dans une
 * palette où cohabitent un vert sombre, un orange, un jaune vif. Une encre
 * blanche fixe y tombait sous le seuil WCAG AA (4,5:1) dès le deuxième joueur :
 * 2,83:1 sur l'orange `#d4892b`, relevé par axe sur l'écran de partie.
 *
 * Entre le blanc et le noir, l'un des deux tient TOUJOURS au moins 4,58:1, quel
 * que soit le fond : la bascule se fait à la luminance où les deux rapports
 * s'égalent (≈ 0,179). Un gris presque noir n'offrirait plus cette garantie
 * sur les tons moyens (bleu `#3a7bd5`), d'où le noir franc.
 */

/** Luminance relative WCAG d'une couleur `#rrggbb`. */
export function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Rapport de contraste WCAG entre deux couleurs `#rrggbb`. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  ) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** L'encre, blanche ou noire, qui contraste le plus sur `background`. */
export function inkOn(background: string): '#ffffff' | '#000000' {
  return contrastRatio('#ffffff', background) >=
    contrastRatio('#000000', background)
    ? '#ffffff'
    : '#000000';
}
