import { describe, expect, it } from 'vitest';
import { FinishedMatchSchema, type FinishedMatch } from '../schemas';
import { detectAchievements } from './achievements';

/**
 * `detectAchievements` était couvert à 1,96 % : cent soixante-dix-sept lignes
 * de règles pures, six badges, et aucun test. Or un badge est une promesse
 * faite au joueur — décerné à tort il ne se retire pas, oublié il ne se voit
 * pas. Rien dans le typage ne distingue `DEFS[2]` de `DEFS[3]`.
 *
 * Chaque détecteur est donc éprouvé dans les DEUX sens : la condition qui
 * l'ouvre, et celle qui s'en approche sans l'ouvrir.
 */

const JOUEUR = 'p1';
const AUTRE = 'p2';

let sequence = 0;

function personne(id: string) {
  return { id, name: id, color: '#123456', createdAt: 0 };
}

interface Partie {
  id: string;
  /** Défaut : `JOUEUR` gagne. */
  gagnant?: string;
  /** Défaut : `JOUEUR` et `AUTRE` sont à la table. */
  joueurs?: readonly string[];
  finieA: number;
  /** Score de chaque lancer de `JOUEUR`. `0` = un raté. Défaut : un lancer. */
  lancers?: readonly number[];
  /** Indice du lancer qui a fait dépasser la cible. */
  depassementAu?: number;
  /** Score porté au classement pour `JOUEUR`. */
  scoreFinal?: number;
  cible?: 25 | 50 | 100;
  /** `JOUEUR` joue mais n'apparaît pas au classement (partie corrompue). */
  sansClassement?: boolean;
}

/**
 * Une partie terminée, VALIDÉE par le schéma de l'application.
 *
 * `FinishedMatchSchema.parse` plutôt qu'une conversion : une fixture qui ne
 * pourrait pas exister dans l'app ne prouverait rien des badges, et le schéma
 * remplit au passage les champs à valeur par défaut.
 */
function partie(o: Partie): FinishedMatch {
  const joueurs = o.joueurs ?? [JOUEUR, AUTRE];
  const scores = o.lancers ?? [1];

  return FinishedMatchSchema.parse({
    id: o.id,
    config: {
      players: joueurs.map(personne),
      ...(o.cible === undefined ? {} : { targetScore: o.cible }),
    },
    throws: scores.map((score, i) => {
      sequence += 1;
      return {
        id: `t${sequence}`,
        playerId: JOUEUR,
        timestamp: sequence,
        fallenPins: score > 0 ? [score] : [],
        computedScore: score,
        resultedInOvershoot: o.depassementAu === i,
      };
    }),
    startedAt: o.finieA - 1,
    finishedAt: o.finieA,
    winnerId: o.gagnant ?? JOUEUR,
    ranking: o.sansClassement
      ? [{ playerId: AUTRE, finalScore: 50, eliminated: false, rank: 1 }]
      : [
          {
            playerId: JOUEUR,
            finalScore: o.scoreFinal ?? 0,
            eliminated: false,
            rank: 1,
          },
        ],
  });
}

/** Les identifiants des badges décernés, dans l'ordre de délivrance. */
const badges = (historique: readonly FinishedMatch[]): string[] =>
  detectAchievements(JOUEUR, historique).map(a => a.def.id);

describe('detectAchievements', () => {
  it('un historique vide ne décerne rien', () => {
    expect(badges([])).toEqual([]);
  });

  it('ne regarde que les parties où le joueur était à la table', () => {
    // Une partie entre tiers ne doit ni décerner ni compter : sans ce filtre,
    // dix parties des autres feraient un « vétéran » qui n'a jamais joué.
    const etrangere = partie({
      id: 'm1',
      joueurs: [AUTRE, 'p3'],
      gagnant: AUTRE,
      finieA: 10,
    });

    expect(badges([etrangere])).toEqual([]);
  });
});

describe('first-fifty — finir EXACTEMENT à la cible', () => {
  it('décerné quand le score final égale la cible', () => {
    expect(
      badges([partie({ id: 'm1', finieA: 10, scoreFinal: 50, cible: 50 })])
    ).toContain('first-fifty');
  });

  it('la cible du match fait foi, pas cinquante', () => {
    // Le dépôt joue aussi en 25 et en 100 : comparer à un littéral priverait
    // ces parties du badge, et le décernerait à tort en 100 points.
    expect(
      badges([partie({ id: 'm1', finieA: 10, scoreFinal: 25, cible: 25 })])
    ).toContain('first-fifty');
    expect(
      badges([partie({ id: 'm1', finieA: 10, scoreFinal: 50, cible: 100 })])
    ).not.toContain('first-fifty');
  });

  it('pas décerné à un score en dessous de la cible', () => {
    expect(
      badges([partie({ id: 'm1', finieA: 10, scoreFinal: 49, cible: 50 })])
    ).not.toContain('first-fifty');
  });

  it('pas décerné à une partie PERDUE, même finie à la cible', () => {
    expect(
      badges([
        partie({
          id: 'm1',
          finieA: 10,
          gagnant: AUTRE,
          scoreFinal: 50,
          cible: 50,
        }),
      ])
    ).not.toContain('first-fifty');
  });
});

describe('fast-win — gagner en moins de dix lancers', () => {
  it('décerné à neuf lancers', () => {
    expect(
      badges([partie({ id: 'm1', finieA: 10, lancers: Array(9).fill(3) })])
    ).toContain('fast-win');
  });

  it('pas décerné à dix — la borne est stricte', () => {
    expect(
      badges([partie({ id: 'm1', finieA: 10, lancers: Array(10).fill(3) })])
    ).not.toContain('fast-win');
  });

  it('pas décerné sans aucun lancer', () => {
    // Zéro est bien « moins de dix ». Sans la garde `length > 0`, une partie
    // gagnée par forfait décernerait le badge du joueur le plus rapide.
    expect(
      badges([partie({ id: 'm1', finieA: 10, lancers: [] })])
    ).not.toContain('fast-win');
  });
});

describe('perfect-game — aucun lancer nul', () => {
  it('décerné quand tous les lancers marquent', () => {
    expect(
      badges([partie({ id: 'm1', finieA: 10, lancers: [3, 7, 12] })])
    ).toContain('perfect-game');
  });

  it('un seul raté suffit à le refuser', () => {
    expect(
      badges([partie({ id: 'm1', finieA: 10, lancers: [3, 0, 12] })])
    ).not.toContain('perfect-game');
  });

  it('pas décerné sans aucun lancer', () => {
    // `[].every(…)` vaut `true` : sans la garde `length > 0`, une partie sans
    // le moindre lancer serait « parfaite ».
    expect(
      badges([partie({ id: 'm1', finieA: 10, lancers: [] })])
    ).not.toContain('perfect-game');
  });
});

describe('three-in-a-row — les trois DERNIÈRES gagnées', () => {
  it('décerné sur les trois plus récentes, quel que soit l’ordre du tableau', () => {
    // L'historique n'est pas trié : le détecteur trie par `finishedAt`. Les
    // parties sont volontairement données à l'envers.
    expect(
      badges([
        partie({ id: 'm2', finieA: 20 }),
        partie({ id: 'm3', finieA: 30 }),
        partie({ id: 'm1', finieA: 10 }),
      ])
    ).toContain('three-in-a-row');
  });

  it('une défaite ANCIENNE ne l’empêche pas', () => {
    expect(
      badges([
        partie({ id: 'm0', finieA: 5, gagnant: AUTRE }),
        partie({ id: 'm1', finieA: 10 }),
        partie({ id: 'm2', finieA: 20 }),
        partie({ id: 'm3', finieA: 30 }),
      ])
    ).toContain('three-in-a-row');
  });

  it('une défaite RÉCENTE l’empêche', () => {
    expect(
      badges([
        partie({ id: 'm1', finieA: 10 }),
        partie({ id: 'm2', finieA: 20 }),
        partie({ id: 'm3', finieA: 30, gagnant: AUTRE }),
      ])
    ).not.toContain('three-in-a-row');
  });

  it('deux victoires ne suffisent pas', () => {
    expect(
      badges([
        partie({ id: 'm1', finieA: 10 }),
        partie({ id: 'm2', finieA: 20 }),
      ])
    ).not.toContain('three-in-a-row');
  });
});

describe('veteran — dix parties jouées', () => {
  const serie = (n: number, gagnant = JOUEUR) =>
    Array.from({ length: n }, (_, i) =>
      partie({ id: `m${i}`, finieA: 100 + i, gagnant })
    );

  it('décerné à la dixième', () => {
    expect(badges(serie(10))).toContain('veteran');
  });

  it('pas à la neuvième', () => {
    expect(badges(serie(9))).not.toContain('veteran');
  });

  it('compte les parties JOUÉES, pas gagnées', () => {
    expect(badges(serie(10, AUTRE))).toContain('veteran');
  });
});

describe('comeback — gagner après avoir dépassé la cible', () => {
  it('décerné quand un lancer a fait dépasser, dans une partie gagnée', () => {
    expect(
      badges([
        partie({ id: 'm1', finieA: 10, lancers: [5, 5, 5], depassementAu: 1 }),
      ])
    ).toContain('comeback');
  });

  it('pas décerné sans dépassement', () => {
    expect(
      badges([partie({ id: 'm1', finieA: 10, lancers: [5, 5, 5] })])
    ).not.toContain('comeback');
  });

  it('pas décerné sur une partie PERDUE avec dépassement', () => {
    expect(
      badges([
        partie({
          id: 'm1',
          finieA: 10,
          gagnant: AUTRE,
          lancers: [5, 5, 5],
          depassementAu: 1,
        }),
      ])
    ).not.toContain('comeback');
  });

  it('une partie gagnée sans entrée au classement est ignorée', () => {
    // Historique abîmé : le joueur a gagné mais ne figure pas au classement.
    // Le détecteur passe son chemin plutôt que de lire `undefined`.
    expect(
      badges([
        partie({
          id: 'm1',
          finieA: 10,
          lancers: [5, 5, 5],
          depassementAu: 1,
          sansClassement: true,
        }),
      ])
    ).not.toContain('comeback');
  });
});

describe('unicité', () => {
  it('un badge n’est décerné qu’une fois, même mérité dix fois', () => {
    const dix = Array.from({ length: 10 }, (_, i) =>
      partie({
        id: `m${i}`,
        finieA: 100 + i,
        lancers: [5, 5, 5],
        depassementAu: 1,
        scoreFinal: 50,
        cible: 50,
      })
    );

    const obtenus = badges(dix);

    expect(new Set(obtenus).size).toBe(obtenus.length);
    expect(obtenus.toSorted()).toEqual([
      'comeback',
      'fast-win',
      'first-fifty',
      'perfect-game',
      'three-in-a-row',
      'veteran',
    ]);
  });

  it('chaque badge porte sa définition, sa date et sa partie', () => {
    // Le rendu lit `def.iconName` et `def.labelKey` : une définition prise au
    // mauvais indice afficherait l'icône d'un autre badge sans qu'un type
    // proteste — `DEFS[2]` et `DEFS[3]` ont exactement la même forme.
    const obtenus = detectAchievements(JOUEUR, [
      partie({ id: 'm1', finieA: 42, scoreFinal: 50, cible: 50 }),
    ]);
    const premier = obtenus.find(a => a.def.id === 'first-fifty');

    expect(premier).toMatchObject({
      def: {
        id: 'first-fifty',
        iconName: 'target',
        labelKey: 'achievements.firstFifty',
        descKey: 'achievements.firstFiftyDesc',
      },
      unlockedAt: 42,
      matchId: 'm1',
    });
  });

  it('les six définitions sont distinctes — identifiant, icône et libellé', () => {
    // Une seule partie qui mérite tout : c'est le moment où un copier-coller
    // entre définitions se verrait.
    const obtenus = detectAchievements(
      JOUEUR,
      Array.from({ length: 10 }, (_, i) =>
        partie({
          id: `m${i}`,
          finieA: 100 + i,
          lancers: [5, 5, 5],
          depassementAu: 1,
          scoreFinal: 50,
          cible: 50,
        })
      )
    );

    expect(new Set(obtenus.map(a => a.def.id)).size).toBe(6);
    expect(new Set(obtenus.map(a => a.def.iconName)).size).toBe(6);
    expect(new Set(obtenus.map(a => a.def.labelKey)).size).toBe(6);
    for (const { def } of obtenus) {
      expect(def.descKey).toBe(`${def.labelKey}Desc`);
    }
  });
});
