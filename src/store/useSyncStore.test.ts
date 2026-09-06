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
 * DEUX APPAREILS, UNE SEULE LIGNE DANS LE NUAGE.
 *
 * Le nuage est ici une variable ; les magasins, eux, sont les vrais. Changer
 * d'appareil, c'est reposer l'état local et rappeler la même fonction — ce que
 * fait `poserAppareil`. C'est le seul montage qui éprouve la chaîne complète
 * (magasins → fusion → charge utile → magasins), et donc le seul qui aurait
 * attrapé l'écrasement d'avant.
 */
const cloud = vi.hoisted(() => ({
  row: null as null | { payload: unknown; updatedAt: string },
  echouerProchaineLecture: false,
}));

vi.mock('../cloudSync', () => ({
  pullSync: async () => {
    if (cloud.echouerProchaineLecture) {
      cloud.echouerProchaineLecture = false;
      throw new Error('relation "user_data" does not exist');
    }
    return cloud.row;
  },
  pushSync: async (payload: unknown) => {
    cloud.row = { payload, updatedAt: '2026-09-06T12:00:00.000Z' };
    return cloud.row;
  },
}));

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

beforeEach(() => {
  cloud.row = null;
  cloud.echouerProchaineLecture = false;
  localStorage.clear();
  useSettingsStore.getState().reset();
  useSyncStore.setState({
    enabled: true,
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
    expect(cloud.row?.payload).not.toHaveProperty('current');
    expect(useSyncStore.getState().lastOutcome?.currentMatchKept).toBe(true);

    // Et une récupération ne la remplace pas non plus.
    await useSyncStore.getState().pullNow();
    expect(useMatchStore.getState().current?.id).toBe('en-cours');
  });

  it('n’écrit rien quand la lecture du nuage échoue', async () => {
    poserAppareil({ history: [match('m1', 1_000_000)] });
    await useSyncStore.getState().pushNow();
    const avant = cloud.row;

    poserAppareil({ history: [match('m2', 2_000_000)] });
    cloud.echouerProchaineLecture = true;
    await useSyncStore.getState().pushNow();

    // Envoyer à l'aveugle après un échec de lecture, c'est l'écrasement
    // d'avant : la ligne du nuage n'a pas bougé, l'erreur est à l'écran.
    expect(cloud.row).toBe(avant);
    expect(useSyncStore.getState().status).toBe('error');
    expect(useSyncStore.getState().error).toContain('user_data');
  });

  it('ne fait rien tant que l’utilisateur n’a pas activé la synchro', async () => {
    useSyncStore.setState({ enabled: false });
    poserAppareil({ history: [match('m1', 1_000_000)] });

    await useSyncStore.getState().pushNow();
    await useSyncStore.getState().pullNow();

    expect(cloud.row).toBeNull();
  });
});
