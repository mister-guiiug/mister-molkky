import { describe, expect, it } from 'vitest';
import {
  accuracy,
  averageScorePerMatch,
  averageScorePerThrow,
  computeStats,
  computeWinRateTrend,
  computeWinStreak,
  headToHead,
  winRate,
  type MatchStatsInput,
  type MatchTimelineEntry,
} from './stats';

const matches: MatchStatsInput[] = [
  {
    playerIds: ['a', 'b'],
    throws: [
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [2] },
    ],
    winnerId: 'a',
  },
  {
    playerIds: ['a', 'b'],
    throws: [
      { playerId: 'a', fallenPins: [] },
      { playerId: 'b', fallenPins: [5] },
      { playerId: 'a', fallenPins: [] },
      { playerId: 'b', fallenPins: [5] },
      { playerId: 'a', fallenPins: [] },
    ],
    winnerId: 'b',
  },
];

describe('computeStats', () => {
  const stats = computeStats(matches);

  it('counts matches played and won', () => {
    expect(stats.get('a')?.matchesPlayed).toBe(2);
    expect(stats.get('a')?.matchesWon).toBe(1);
    expect(stats.get('b')?.matchesWon).toBe(1);
  });

  it('counts exact-fifty victories', () => {
    expect(stats.get('a')?.exactFifties).toBe(1);
  });

  it('counts pins hit and total throws', () => {
    expect(stats.get('a')?.totalThrows).toBe(8);
    expect(stats.get('a')?.totalPinsHit).toBeGreaterThanOrEqual(5);
  });

  it('tracks pin frequency for single-pin hits', () => {
    expect(stats.get('a')?.pinFrequency[12]).toBe(4);
    expect(stats.get('a')?.topPin).toBe(12);
    expect(stats.get('b')?.pinFrequency[1]).toBeGreaterThan(0);
  });

  it('tracks longest scoring streak', () => {
    expect(stats.get('a')?.bestStreak).toBeGreaterThanOrEqual(4);
  });
});

describe('derived metrics', () => {
  const stats = computeStats(matches);

  it('win rate', () => {
    expect(winRate(stats.get('a')!)).toBe(0.5);
    expect(winRate(stats.get('b')!)).toBe(0.5);
  });

  it('accuracy (pinsHit / totalThrows)', () => {
    const a = stats.get('a')!;
    expect(accuracy(a)).toBeGreaterThan(0);
    expect(accuracy(a)).toBeLessThanOrEqual(12);
  });

  it('avg score per match', () => {
    expect(averageScorePerMatch(stats.get('a')!)).toBeGreaterThan(0);
  });

  it('avg score per throw', () => {
    expect(averageScorePerThrow(stats.get('a')!)).toBeGreaterThan(0);
  });

  it('returns 0 for empty stats', () => {
    const empty = {
      playerId: 'x',
      matchesPlayed: 0,
      matchesWon: 0,
      podiums: 0,
      totalThrows: 0,
      totalPinsHit: 0,
      totalScore: 0,
      bestStreak: 0,
      exactFifties: 0,
      overshoots: 0,
      pinFrequency: {},
      topPin: null,
    };
    expect(winRate(empty)).toBe(0);
    expect(accuracy(empty)).toBe(0);
    expect(averageScorePerMatch(empty)).toBe(0);
    expect(averageScorePerThrow(empty)).toBe(0);
  });
});

describe('computeStats — overshoots', () => {
  it('counts overshoots properly', () => {
    const result = computeStats([
      {
        playerIds: ['a', 'b'],
        throws: [
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [1] },
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [1] },
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [1] },
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [1] },
          { playerId: 'a', fallenPins: [12] },
        ],
        winnerId: null,
      },
    ]);
    expect(result.get('a')?.overshoots).toBe(1);
  });
});

describe('computeStats — les quilles multiples et le podium', () => {
  it('plusieurs quilles valent LEUR NOMBRE, une seule vaut sa valeur', () => {
    // La règle du Mölkky, et le seul endroit du fichier où les deux se
    // confondraient sans dommage visible : abattre les quilles 10, 11 et 12
    // rapporte 3, pas 33. Confondre les deux ferait gagner en deux lancers.
    const result = computeStats([
      {
        playerIds: ['a', 'b'],
        throws: [
          { playerId: 'a', fallenPins: [10, 11, 12] },
          { playerId: 'b', fallenPins: [7] },
        ],
        winnerId: null,
      },
    ]);

    // Les quilles multiples ne nourrissent pas la fréquence : on ne sait pas
    // laquelle le joueur visait.
    expect(result.get('a')?.pinFrequency).toEqual({});
    expect(result.get('a')?.topPin).toBeNull();
    expect(result.get('b')?.pinFrequency).toEqual({ 7: 1 });
    expect(result.get('b')?.topPin).toBe(7);
  });

  it('le podium s’arrête à trois, même à quatre joueurs', () => {
    const result = computeStats([
      {
        playerIds: ['a', 'b', 'c', 'd'],
        throws: [
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [9] },
          { playerId: 'c', fallenPins: [6] },
          { playerId: 'd', fallenPins: [1] },
        ],
        winnerId: null,
      },
    ]);

    expect(result.get('a')?.podiums).toBe(1);
    expect(result.get('c')?.podiums).toBe(1);
    expect(result.get('d')?.podiums).toBe(0);
  });

  it('un lancer d’un joueur hors de la partie fait ÉCHOUER le calcul', () => {
    // Et ne produit pas des statistiques fausses en silence. `computeStats`
    // rejoue d'abord la partie (`replayThrows`), qui refuse un lancer hors
    // tour : l'erreur remonte telle quelle.
    //
    // C'est ce qui rend la garde `if (!stats) continue` de la seconde boucle
    // inatteignable — le rejeu a déjà levé. Elle est laissée en place, mais
    // aucun test ne peut l'exercer, et la couverture de branches du fichier
    // s'en ressent d'une unité.
    expect(() =>
      computeStats([
        {
          playerIds: ['a', 'b'],
          throws: [
            { playerId: 'a', fallenPins: [12] },
            { playerId: 'intrus', fallenPins: [5] },
          ],
          winnerId: null,
        },
      ])
    ).toThrow(/Throw out of order/);
  });
});

describe('computeWinStreak', () => {
  const ligne = (...resultats: readonly boolean[]): MatchTimelineEntry[] =>
    resultats.map((won, i) => ({ id: `m${i}`, finishedAt: i, won }));

  it('un historique vide ne compte rien', () => {
    expect(computeWinStreak([])).toEqual({ currentStreak: 0, bestStreak: 0 });
  });

  it('la série COURANTE s’arrête à la dernière défaite', () => {
    // C'est la distinction qui porte tout : `bestStreak` est un record,
    // `currentStreak` est un élan. Les confondre afficherait « 3 victoires
    // d'affilée » à quelqu'un qui vient d'en perdre deux.
    expect(computeWinStreak(ligne(true, true, true, false))).toEqual({
      currentStreak: 0,
      bestStreak: 3,
    });
  });

  it('série courante et record peuvent différer', () => {
    expect(
      computeWinStreak(ligne(true, true, true, false, true, true))
    ).toEqual({ currentStreak: 2, bestStreak: 3 });
  });

  it('tout gagné : les deux coïncident', () => {
    expect(computeWinStreak(ligne(true, true))).toEqual({
      currentStreak: 2,
      bestStreak: 2,
    });
  });

  it('tout perdu : aucune série', () => {
    expect(computeWinStreak(ligne(false, false))).toEqual({
      currentStreak: 0,
      bestStreak: 0,
    });
  });

  it('l’ordre d’entrée n’a pas d’importance — la date fait foi', () => {
    // L'appelant passe l'historique dans l'ordre qu'il veut ; la fonction
    // trie. Sans ce tri, la « série courante » se lirait à la fin du tableau
    // et non à la partie la plus récente.
    const desordre: MatchTimelineEntry[] = [
      { id: 'recente', finishedAt: 30, won: false },
      { id: 'ancienne', finishedAt: 10, won: true },
      { id: 'moyenne', finishedAt: 20, won: true },
    ];

    expect(computeWinStreak(desordre)).toEqual({
      currentStreak: 0,
      bestStreak: 2,
    });
  });
});

describe('computeWinRateTrend', () => {
  const ligne = (...resultats: readonly boolean[]): MatchTimelineEntry[] =>
    resultats.map((won, i) => ({ id: `m${i}`, finishedAt: i, won }));

  it('un historique vide ou une fenêtre nulle ne rendent rien', () => {
    expect(computeWinRateTrend([], 3)).toEqual([]);
    expect(computeWinRateTrend(ligne(true, false), 0)).toEqual([]);
    expect(computeWinRateTrend(ligne(true, false), -1)).toEqual([]);
  });

  it('une valeur par partie, du plus ancien au plus récent', () => {
    expect(computeWinRateTrend(ligne(true, false, true, true), 2)).toEqual([
      1, // [V]
      0.5, // [V, D]
      0.5, // [D, V]
      1, // [V, V]
    ]);
  });

  it('au début, la fenêtre est plus courte que demandé', () => {
    // Sans le `Math.max(0, …)`, la première valeur se diviserait par la
    // taille de fenêtre et non par le nombre de parties réellement jouées :
    // un joueur qui gagne sa première partie afficherait 20 % au lieu de
    // 100 %.
    expect(computeWinRateTrend(ligne(true), 5)).toEqual([1]);
  });

  it('les valeurs restent dans [0, 1]', () => {
    const trend = computeWinRateTrend(ligne(true, true, false, true, false), 3);

    expect(trend).toHaveLength(5);
    for (const v of trend) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('l’ordre d’entrée n’a pas d’importance — la date fait foi', () => {
    const desordre: MatchTimelineEntry[] = [
      { id: 'b', finishedAt: 20, won: false },
      { id: 'a', finishedAt: 10, won: true },
    ];

    expect(computeWinRateTrend(desordre, 10)).toEqual([1, 0.5]);
  });
});

describe('headToHead', () => {
  const duel: MatchStatsInput[] = [
    {
      playerIds: ['a', 'b'],
      throws: [
        { playerId: 'a', fallenPins: [12] },
        { playerId: 'b', fallenPins: [3] },
      ],
      winnerId: 'a',
    },
    {
      playerIds: ['a', 'b'],
      throws: [
        { playerId: 'a', fallenPins: [] },
        { playerId: 'b', fallenPins: [8] },
      ],
      winnerId: 'b',
    },
    // `a` a joué contre quelqu'un d'autre : hors du duel.
    {
      playerIds: ['a', 'c'],
      throws: [{ playerId: 'a', fallenPins: [12] }],
      winnerId: 'a',
    },
  ];

  it('ne retient que les parties où les DEUX étaient à la table', () => {
    // Sans ce double filtre, la carte de duel compterait les victoires de `a`
    // contre des tiers comme des victoires contre `b`.
    expect(headToHead(duel, 'a', 'b')).toMatchObject({
      sharedMatches: 2,
      winsA: 1,
      winsB: 1,
    });
  });

  it('les moyennes portent sur les parties partagées, pas sur toutes', () => {
    const h2h = headToHead(duel, 'a', 'b');

    // `a` : 12 puis 0 sur deux parties partagées — la troisième, gagnée
    // contre `c`, ne doit pas relever sa moyenne.
    expect(h2h.avgScoreA).toBe(6);
    expect(h2h.avgScoreB).toBe(5.5);
  });

  it('la précision est le ratio quilles touchées sur lancers', () => {
    const h2h = headToHead(duel, 'a', 'b');

    // `a` : un lancer qui touche, un qui rate, sur deux parties.
    expect(h2h.accuracyA).toBe(0.5);
    expect(h2h.accuracyB).toBe(1);
  });

  it('deux joueurs qui ne se sont jamais croisés rendent des zéros', () => {
    // Et non `NaN` : la division par zéro est gardée aux quatre endroits, et
    // un `NaN` traverserait l'affichage jusqu'à l'écran du joueur.
    const h2h = headToHead(duel, 'b', 'c');

    expect(h2h).toEqual({
      sharedMatches: 0,
      winsA: 0,
      winsB: 0,
      avgScoreA: 0,
      avgScoreB: 0,
      accuracyA: 0,
      accuracyB: 0,
    });
  });

  it('une partie sans vainqueur ne compte pour personne', () => {
    const h2h = headToHead(
      [
        {
          playerIds: ['a', 'b'],
          throws: [{ playerId: 'a', fallenPins: [5] }],
          winnerId: null,
        },
      ],
      'a',
      'b'
    );

    expect(h2h).toMatchObject({ sharedMatches: 1, winsA: 0, winsB: 0 });
  });
});
