/**
 * Plan officiel des 12 quilles en début de partie.
 *
 *         7   9   8
 *       5  11  12   6
 *         3  10   4
 *           1   2
 *               ← tireur
 *
 * Coordonnées (x, y) dans une grille 4×4 ; (0,0) en bas-gauche.
 */

export interface PinPosition {
  readonly pin: number;
  readonly x: number;
  readonly y: number;
}

export const INITIAL_LAYOUT: readonly PinPosition[] = [
  { pin: 1, x: 1.5, y: 0 },
  { pin: 2, x: 2.5, y: 0 },
  { pin: 3, x: 1, y: 1 },
  { pin: 10, x: 2, y: 1 },
  { pin: 4, x: 3, y: 1 },
  { pin: 5, x: 0.5, y: 2 },
  { pin: 11, x: 1.5, y: 2 },
  { pin: 12, x: 2.5, y: 2 },
  { pin: 6, x: 3.5, y: 2 },
  { pin: 7, x: 1, y: 3 },
  { pin: 9, x: 2, y: 3 },
  { pin: 8, x: 3, y: 3 },
];

export const ALL_PIN_NUMBERS: readonly number[] = INITIAL_LAYOUT.map(
  p => p.pin
);

export const LAYOUT_BOUNDS = {
  minX: 0.5,
  maxX: 3.5,
  minY: 0,
  maxY: 3,
} as const;
