import { describe, expect, it } from 'vitest';
import { contrastRatio, inkOn, relativeLuminance } from './contrast';
import { pickNextColor } from './store/usePlayersStore';
import type { Player } from './schemas';

/** Les couleurs que l'app distribue d'office, dans l'ordre d'attribution. */
function defaultPalette(): string[] {
  const players: Player[] = [];
  for (;;) {
    const color = pickNextColor(players);
    if (players.some(p => p.color === color)) return players.map(p => p.color);
    players.push({ color } as Player);
  }
}

describe('contrastRatio', () => {
  it('rend les valeurs de référence WCAG', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('retrouve le défaut relevé par axe : blanc sur l’orange du 2e joueur', () => {
    expect(contrastRatio('#ffffff', '#d4892b')).toBeCloseTo(2.83, 2);
  });
});

describe('inkOn', () => {
  it('garde le blanc sur le vert sombre du premier joueur, passe au noir sur l’orange', () => {
    expect(inkOn('#4a7c2a')).toBe('#ffffff');
    expect(inkOn('#d4892b')).toBe('#000000');
  });

  it('tient 4,5:1 sur chaque couleur de la palette par défaut', () => {
    const palette = defaultPalette();
    // Non-vacuité : une palette qui rendrait une seule couleur passerait.
    expect(palette.length).toBeGreaterThanOrEqual(16);
    for (const color of palette) {
      expect(
        contrastRatio(inkOn(color), color),
        `${inkOn(color)} sur ${color}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tient 4,5:1 sur n’importe quelle couleur, pas seulement la palette', () => {
    const steps = [0, 0x33, 0x66, 0x80, 0x99, 0xb3, 0xcc, 0xff];
    const hex = (n: number) => n.toString(16).padStart(2, '0');
    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) {
          const color = `#${hex(r)}${hex(g)}${hex(b)}`;
          expect(contrastRatio(inkOn(color), color)).toBeGreaterThanOrEqual(
            4.5
          );
        }
      }
    }
  });
});
