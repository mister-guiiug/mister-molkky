import { describe, expect, it } from 'vitest';
import {
  FinishedMatchSchema,
  MatchTemplateSchema,
  PlayerSchema,
  type FinishedMatch,
  type MatchTemplate,
  type Player,
} from '../schemas';
import {
  EMPTY_SNAPSHOT,
  mergeById,
  mergeSnapshots,
  readRemoteSnapshot,
  recencyOf,
  type SyncSnapshot,
} from './merge';

/**
 * Les scénarios de VALEUR.md, joués sur la fonction pure. Ils décrivent tous la
 * même chose : deux appareils, une seule ligne dans le nuage, et rien qui
 * disparaisse.
 */
function player(
  id: string,
  name: string,
  dates: { createdAt: number; updatedAt?: number }
): Player {
  return PlayerSchema.parse({
    id,
    name,
    color: '#4a7c2a',
    createdAt: dates.createdAt,
    ...(dates.updatedAt === undefined ? {} : { updatedAt: dates.updatedAt }),
  });
}

const ALICE = player('p1', 'Alice', { createdAt: 1_000 });
const BOB = player('p2', 'Bob', { createdAt: 2_000 });

function match(id: string, finishedAt: number, winnerId = 'p1'): FinishedMatch {
  return FinishedMatchSchema.parse({
    id,
    config: {
      players: [ALICE, BOB],
      targetScore: 50,
      overshootPenalty: 25,
      maxMisses: 3,
      teams: [],
      handicaps: {},
    },
    throws: [],
    startedAt: finishedAt - 600_000,
    finishedAt,
    winnerId,
    ranking: [
      { playerId: winnerId, finalScore: 50, eliminated: false, rank: 1 },
      {
        playerId: winnerId === 'p1' ? 'p2' : 'p1',
        finalScore: 30,
        eliminated: false,
        rank: 2,
      },
    ],
  });
}

function template(
  id: string,
  name: string,
  dates: { createdAt: number; updatedAt?: number }
): MatchTemplate {
  return MatchTemplateSchema.parse({
    id,
    name,
    targetScore: 50,
    overshootPenalty: 25,
    maxMisses: 3,
    playerIds: [],
    createdAt: dates.createdAt,
    ...(dates.updatedAt === undefined ? {} : { updatedAt: dates.updatedAt }),
  });
}

function snapshot(partial: Partial<SyncSnapshot>): SyncSnapshot {
  return { ...EMPTY_SNAPSHOT, ...partial };
}

describe('fusion par identifiant', () => {
  it('deux appareils, deux parties chacun → quatre parties', () => {
    // Le jardin.
    const appareilA = snapshot({
      players: [ALICE, BOB],
      history: [match('m2', 2_000_000), match('m1', 1_000_000)],
    });
    // La maison, le même soir, sans avoir jamais vu les parties du jardin.
    const appareilB = snapshot({
      players: [ALICE, BOB],
      history: [match('m4', 4_000_000), match('m3', 3_000_000)],
    });

    const { merged, report } = mergeSnapshots(appareilA, appareilB);

    expect(merged.history.map(m => m.id)).toEqual(['m4', 'm3', 'm2', 'm1']);
    expect(report.history).toEqual({ added: 2, updated: 0, dropped: 0 });
    // Et l'opération est symétrique : l'autre appareil aboutit au même jeu.
    const inverse = mergeSnapshots(appareilB, appareilA);
    expect(inverse.merged.history.map(m => m.id)).toEqual([
      'm4',
      'm3',
      'm2',
      'm1',
    ]);
  });

  it('même identifiant des deux côtés → une seule ligne, la plus récente', () => {
    const ancien = template('t1', 'Apéro', { createdAt: 1_000 });
    const recent = template('t1', 'Apéro du dimanche', {
      createdAt: 1_000,
      updatedAt: 9_000,
    });

    const { merged, report } = mergeSnapshots(
      snapshot({ templates: [ancien] }),
      snapshot({ templates: [recent] })
    );

    expect(merged.templates).toHaveLength(1);
    expect(merged.templates[0]?.name).toBe('Apéro du dimanche');
    expect(report.templates).toEqual({ added: 0, updated: 1, dropped: 0 });
  });

  it('joueur renommé sur A, partie ajoutée sur B → les deux survivent', () => {
    const renommee = player('p1', 'Alicia', {
      createdAt: 1_000,
      updatedAt: 5_000,
    });
    const appareilA = snapshot({
      players: [renommee, BOB],
      history: [match('m1', 1_000_000)],
    });
    const appareilB = snapshot({
      // B n'a jamais vu le renommage : il a encore l'ancien nom.
      players: [ALICE, BOB],
      history: [match('m1', 1_000_000), match('m2', 2_000_000)],
    });

    const { merged } = mergeSnapshots(appareilA, appareilB);

    expect(merged.players.map(p => p.name)).toEqual(['Alicia', 'Bob']);
    expect(merged.history.map(m => m.id)).toEqual(['m2', 'm1']);
  });

  it('l’exemplaire distant plus ANCIEN ne remplace pas le local', () => {
    const local = player('p1', 'Alicia', {
      createdAt: 1_000,
      updatedAt: 9_000,
    });
    const distant = player('p1', 'Alice', { createdAt: 1_000, updatedAt: 500 });

    const { merged, report } = mergeSnapshots(
      snapshot({ players: [local] }),
      snapshot({ players: [distant] })
    );

    expect(merged.players[0]?.name).toBe('Alicia');
    expect(report.players).toEqual({ added: 0, updated: 0, dropped: 0 });
  });

  it('fusionner deux fois de suite ne réécrit rien', () => {
    const a = snapshot({ players: [ALICE], history: [match('m1', 1_000_000)] });
    const b = snapshot({ players: [BOB], history: [match('m2', 2_000_000)] });

    const premiere = mergeSnapshots(a, b);
    const seconde = mergeSnapshots(premiere.merged, b);

    expect(seconde.merged).toEqual(premiere.merged);
    expect(seconde.report.players).toEqual({
      added: 0,
      updated: 0,
      dropped: 0,
    });
    expect(seconde.report.history).toEqual({
      added: 0,
      updated: 0,
      dropped: 0,
    });
  });

  it('un enregistrement sans updatedAt est daté par sa création', () => {
    expect(recencyOf({ createdAt: 42 })).toBe(42);
    expect(recencyOf({ createdAt: 42, updatedAt: 99 })).toBe(99);
  });

  it('respecte le plafond de deux cents parties, les plus récentes gardées', () => {
    const mine = Array.from({ length: 150 }, (_, i) =>
      match(`mine-${i}`, 1_000_000 + i)
    );
    const theirs = Array.from({ length: 150 }, (_, i) =>
      match(`theirs-${i}`, 5_000_000 + i)
    );

    const { merged, report } = mergeSnapshots(
      snapshot({ history: mine }),
      snapshot({ history: theirs })
    );

    expect(merged.history).toHaveLength(200);
    expect(report.history.added).toBe(150);
    expect(report.history.dropped).toBe(100);
    // Les cent cinquante parties de l'autre appareil sont plus récentes :
    // elles restent toutes, ce sont les plus vieilles locales qui cèdent.
    expect(merged.history.filter(m => m.id.startsWith('theirs-'))).toHaveLength(
      150
    );
  });

  it('mergeById garde l’ordre local, les nouveaux venus à la fin', () => {
    const { merged } = mergeById(
      [
        { id: 'a', at: 1 },
        { id: 'b', at: 1 },
      ],
      [
        { id: 'c', at: 1 },
        { id: 'a', at: 1 },
      ],
      r => r.id,
      r => r.at
    );
    expect(merged.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('lecture de la charge utile distante', () => {
  it('écarte les enregistrements que le schéma refuse, garde les autres', () => {
    const lu = readRemoteSnapshot({
      players: [ALICE, { id: 'p9', name: '' }, BOB],
      history: [match('m1', 1_000), { id: 'sans-vainqueur' }],
      templates: 'pas un tableau',
    });

    expect(lu.players.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(lu.history.map(m => m.id)).toEqual(['m1']);
    expect(lu.templates).toEqual([]);
  });

  it('accepte une charge utile vide ou absente', () => {
    expect(readRemoteSnapshot(null)).toEqual(EMPTY_SNAPSHOT);
    expect(readRemoteSnapshot({})).toEqual(EMPTY_SNAPSHOT);
  });
});
