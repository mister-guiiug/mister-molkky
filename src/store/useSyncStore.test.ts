import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CurrentMatchStateSchema,
  FinishedMatchSchema,
  PlayerSchema,
  type CurrentMatchState,
  type FinishedMatch,
  type Player,
} from '../schemas';

/**
 * DEUX APPAREILS, UNE SEULE CLÉ, UNE SEULE LIGNE DANS LE NUAGE.
 *
 * Le nuage est ici une table en mémoire, indexée par clé et versionnée comme
 * `user_data` (0004) : un envoi fondé sur une version périmée est refusé. Les
 * magasins, eux, sont les vrais. Changer d'appareil, c'est reposer l'état
 * local et rappeler la même fonction avec la même clé — ce que fait
 * `poserAppareil`. C'est le seul montage qui éprouve la chaîne complète
 * (magasins → fusion → charge utile → magasins), et donc le seul qui aurait
 * attrapé l'écrasement d'avant.
 */
type CloudRow = { payload: unknown; updatedAt: string; version: number };

const cloud = vi.hoisted(() => ({
  rows: new Map<string, CloudRow>(),
  echouerProchaineLecture: false,
  echouerProchainEffacement: false,
  /**
   * Un AUTRE appareil qui envoie entre la lecture et l'envoi de celui-ci :
   * sa charge utile est écrite juste avant le prochain envoi, et en fait
   * monter la version.
   */
  intrus: [] as unknown[],
}));

vi.mock('../cloudSync', async importOriginal => {
  const actual = await importOriginal<typeof import('../cloudSync')>();
  return {
    ...actual,
    pullSync: async (key: string) => {
      if (cloud.echouerProchaineLecture) {
        cloud.echouerProchaineLecture = false;
        throw new Error('relation "user_data" does not exist');
      }
      return cloud.rows.get(key) ?? null;
    },
    pushSync: async (key: string, payload: unknown, version: number) => {
      const intrus = cloud.intrus.shift();
      if (intrus !== undefined) {
        const avant = cloud.rows.get(key);
        cloud.rows.set(key, {
          payload: intrus,
          updatedAt: '2026-09-30T11:00:00.000Z',
          version: (avant?.version ?? 0) + 1,
        });
      }
      if ((cloud.rows.get(key)?.version ?? 0) !== version) {
        throw new actual.SyncConflictError();
      }
      const row = {
        payload,
        updatedAt: '2026-09-30T12:00:00.000Z',
        version: version + 1,
      };
      cloud.rows.set(key, row);
      return row;
    },
    deleteSync: async (key: string) => {
      if (cloud.echouerProchainEffacement) {
        cloud.echouerProchainEffacement = false;
        throw new Error('Failed to fetch');
      }
      return cloud.rows.delete(key);
    },
  };
});

/** La clé que les deux appareils partagent. */
const CLE = 'AAAABBBBCCCCDDDDEEEEFFFFGGGG';

const { useMatchStore } = await import('./useMatchStore');
const { usePlayersStore } = await import('./usePlayersStore');
const { useTemplatesStore } = await import('./useTemplatesStore');
const { useSettingsStore } = await import('./useSettingsStore');
const { useSyncStore } = await import('./useSyncStore');

function player(id: string, name: string, createdAt: number): Player {
  return PlayerSchema.parse({ id, name, color: '#4a7c2a', createdAt });
}

const ALICE = player('p1', 'Alice', 1_000);
const BOB = player('p2', 'Bob', 2_000);

const CONFIG = {
  players: [ALICE, BOB],
  targetScore: 50,
  overshootPenalty: 25,
  maxMisses: 3,
  teams: [],
  handicaps: {},
};

function match(id: string, finishedAt: number): FinishedMatch {
  return FinishedMatchSchema.parse({
    id,
    config: CONFIG,
    throws: [],
    startedAt: finishedAt - 600_000,
    finishedAt,
    winnerId: 'p1',
    ranking: [
      { playerId: 'p1', finalScore: 50, eliminated: false, rank: 1 },
      { playerId: 'p2', finalScore: 30, eliminated: false, rank: 2 },
    ],
  });
}

const EN_COURS: CurrentMatchState = CurrentMatchStateSchema.parse({
  id: 'en-cours',
  config: CONFIG,
  throws: [],
  startedAt: 3_000_000,
});

/** Change d'appareil : même compte, autre téléphone, autre état local. */
function poserAppareil(state: {
  players?: Player[];
  history?: FinishedMatch[];
  current?: CurrentMatchState | null;
}): void {
  usePlayersStore.setState({ players: state.players ?? [ALICE, BOB] });
  useMatchStore.setState({
    current: state.current ?? null,
    history: state.history ?? [],
    pendingFeedback: null,
  });
  useTemplatesStore.setState({ templates: [] });
}

function idsEnHistorique(): string[] {
  return useMatchStore.getState().history.map(m => m.id);
}

/** La ligne du nuage pour la clé partagée. */
const ligne = () => cloud.rows.get(CLE) ?? null;

beforeEach(() => {
  cloud.rows.clear();
  cloud.echouerProchaineLecture = false;
  cloud.echouerProchainEffacement = false;
  cloud.intrus = [];
  localStorage.clear();
  useSettingsStore.getState().reset();
  useSyncStore.setState({
    enabled: true,
    key: CLE,
    status: 'idle',
    lastSyncAt: null,
    error: null,
    lastOutcome: null,
  });
  poserAppareil({});
});

describe('synchro cloud sans perte', () => {
  it('deux appareils, deux parties chacun → quatre parties après synchro', async () => {
    // Le téléphone du jardin note deux parties et envoie.
    poserAppareil({
      history: [match('m2', 2_000_000), match('m1', 1_000_000)],
    });
    await useSyncStore.getState().pushNow();

    // Celui de la maison en a noté deux autres et envoie à son tour. Avant ce
    // chantier, c'est ici que les deux parties du jardin disparaissaient.
    poserAppareil({
      history: [match('m4', 4_000_000), match('m3', 3_000_000)],
    });
    await useSyncStore.getState().pushNow();

    expect(idsEnHistorique()).toEqual(['m4', 'm3', 'm2', 'm1']);

    // Et le jardin les retrouve toutes les quatre.
    poserAppareil({
      history: [match('m2', 2_000_000), match('m1', 1_000_000)],
    });
    await useSyncStore.getState().pullNow();

    expect(idsEnHistorique()).toEqual(['m4', 'm3', 'm2', 'm1']);
    expect(useSyncStore.getState().lastOutcome?.report.history.added).toBe(2);
  });

  it('récupérer n’écrase plus ce qui n’existe que sur cet appareil', async () => {
    poserAppareil({ history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();

    poserAppareil({ history: [match('m9', 9_000_000)] });
    await useSyncStore.getState().pullNow();

    expect(idsEnHistorique()).toEqual(['m9', 'm1']);
  });

  it('garde le joueur renommé et la partie ajoutée ailleurs', async () => {
    poserAppareil({
      players: [ALICE, BOB],
      history: [match('m1', 1_000_000)],
    });
    await useSyncStore.getState().pushNow();

    // Sur cet appareil, Alice se renomme : `update` pose `updatedAt`.
    usePlayersStore
      .getState()
      .update(ALICE.id, { name: 'Alicia', color: ALICE.color });
    // Et l'autre appareil a ajouté une partie entre-temps.
    poserAppareil({
      players: usePlayersStore.getState().players,
      history: [match('m1', 1_000_000), match('m2', 2_000_000)],
    });
    await useSyncStore.getState().pushNow();

    expect(usePlayersStore.getState().players.map(p => p.name)).toEqual([
      'Alicia',
      'Bob',
    ]);
    expect(idsEnHistorique()).toEqual(['m2', 'm1']);
  });

  it('ne synchronise pas la partie en cours, et le dit à l’écran', async () => {
    poserAppareil({ current: EN_COURS, history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();

    // La charge utile ne porte pas la partie en cours : elle n'a rien à faire
    // dans une fusion, et l'envoyer réintroduirait l'écrasement.
    expect(ligne()?.payload).not.toHaveProperty('current');
    expect(useSyncStore.getState().lastOutcome?.currentMatchKept).toBe(true);

    // Et une récupération ne la remplace pas non plus.
    await useSyncStore.getState().pullNow();
    expect(useMatchStore.getState().current?.id).toBe('en-cours');
  });

  it('n’écrit rien quand la lecture du nuage échoue', async () => {
    poserAppareil({ history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();
    const avant = ligne();

    poserAppareil({ history: [match('m2', 2_000_000)] });
    cloud.echouerProchaineLecture = true;
    await useSyncStore.getState().pushNow();

    // Envoyer à l'aveugle après un échec de lecture, c'est l'écrasement
    // d'avant : la ligne du nuage n'a pas bougé, l'erreur est à l'écran.
    expect(ligne()).toBe(avant);
    expect(useSyncStore.getState().status).toBe('error');
    expect(useSyncStore.getState().error).toContain('user_data');
  });

  it('ne fait rien tant que l’utilisateur n’a pas activé la synchro', async () => {
    useSyncStore.setState({ enabled: false });
    poserAppareil({ history: [match('m1', 1_000_000)] });

    await useSyncStore.getState().pushNow();
    await useSyncStore.getState().pullNow();

    expect(ligne()).toBeNull();
  });

  it('ne fait rien non plus tant que cet appareil n’a pas de clé', async () => {
    useSyncStore.setState({ key: null });
    poserAppareil({ history: [match('m1', 1_000_000)] });

    await useSyncStore.getState().pushNow();
    await useSyncStore.getState().pullNow();

    expect(cloud.rows.size).toBe(0);
    expect(useSyncStore.getState().status).toBe('idle');
  });
});

describe('deux envois simultanés — la version lue fait foi', () => {
  it('un envoi devancé relit, refusionne, et garde l’union de l’autre', async () => {
    poserAppareil({ history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();

    // Pendant que ce téléphone fusionne, l'autre envoie sa propre union.
    // Avant la version, l'envoi d'ici l'écrasait : m3 disparaissait.
    cloud.intrus.push({
      v: 1,
      players: [ALICE, BOB],
      history: [match('m3', 3_000_000), match('m1', 1_000_000)],
      templates: [],
      settings: {},
      pushedAt: 3_000_000,
    });
    poserAppareil({
      history: [match('m2', 2_000_000), match('m1', 1_000_000)],
    });
    await useSyncStore.getState().pushNow();

    expect(useSyncStore.getState().status).toBe('ok');
    expect(idsEnHistorique()).toEqual(['m3', 'm2', 'm1']);
    const envoye = ligne()?.payload as { history: FinishedMatch[] };
    expect(envoye.history.map(m => m.id)).toEqual(['m3', 'm2', 'm1']);
    expect(ligne()?.version).toBe(3);
  });

  it('renonce après trois refus, et le dit au lieu d’écraser', async () => {
    poserAppareil({ history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();
    const intrus = ligne()?.payload;
    cloud.intrus.push(intrus, intrus, intrus);

    poserAppareil({ history: [match('m2', 2_000_000)] });
    await useSyncStore.getState().pushNow();

    expect(useSyncStore.getState().status).toBe('error');
    expect(useSyncStore.getState().error).toMatch(/conflict/i);
    // Les trois écritures de l'autre appareil sont là, rien d'ici ne les a
    // remplacées.
    expect(ligne()?.version).toBe(4);
    expect(ligne()?.payload).toBe(intrus);
  });
});

describe('la clé de synchro', () => {
  it('se crée : 28 caractères crockford32, et rien n’est encore échangé', () => {
    useSyncStore.setState({ key: null, lastSyncAt: '2026-09-01T00:00:00Z' });
    useSyncStore.getState().createKey();

    expect(useSyncStore.getState().key).toMatch(
      /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{28}$/
    );
    expect(useSyncStore.getState().lastSyncAt).toBeNull();
  });

  it('se reprend telle que l’autre appareil l’affiche, ou par son QR', () => {
    useSyncStore.setState({ key: null });
    expect(
      useSyncStore.getState().adoptKey('aaaa-bbbb-cccc-dddd-eeee-ffff-gggg')
    ).toBe(true);
    expect(useSyncStore.getState().key).toBe(CLE);

    useSyncStore.setState({ key: null });
    expect(
      useSyncStore
        .getState()
        .adoptKey('molkky:sync?key=0000111122223333444455556666')
    ).toBe(true);
    expect(useSyncStore.getState().key).toBe('0000111122223333444455556666');
  });

  it('refuse ce qui n’en est pas une, sans toucher à la clé en place', () => {
    expect(useSyncStore.getState().adoptKey('AAAA-BBBB')).toBe(false);
    expect(
      useSyncStore
        .getState()
        .adoptKey('https://mister-guiiug.github.io/mister-molkky/live/MZ7K2A')
    ).toBe(false);
    expect(useSyncStore.getState().key).toBe(CLE);
  });

  it('s’oublie ici sans rien effacer du cloud', async () => {
    poserAppareil({ history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();

    useSyncStore.getState().forgetKey();

    expect(useSyncStore.getState().key).toBeNull();
    expect(ligne()).not.toBeNull();
  });

  it('efface le cloud, puis s’oublie', async () => {
    poserAppareil({ history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();

    await useSyncStore.getState().deleteCloud();

    expect(ligne()).toBeNull();
    expect(useSyncStore.getState().key).toBeNull();
    // Les données de l'appareil, elles, restent.
    expect(idsEnHistorique()).toEqual(['m1']);
  });

  it('garde la clé quand l’effacement échoue : sans elle, plus rien ne s’efface', async () => {
    poserAppareil({ history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();
    cloud.echouerProchainEffacement = true;

    await useSyncStore.getState().deleteCloud();

    expect(useSyncStore.getState().key).toBe(CLE);
    expect(useSyncStore.getState().status).toBe('error');
    expect(ligne()).not.toBeNull();
  });
});
