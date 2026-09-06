import { beforeEach, describe, expect, it } from 'vitest';
import { useMatchStore } from './useMatchStore';
import { usePlayersStore } from './usePlayersStore';
import { useSettingsStore } from './useSettingsStore';
import { useSyncStore } from './useSyncStore';
import { useTemplatesStore } from './useTemplatesStore';

/**
 * L'INSTANTANÉ DES CLÉS `mm_*` D'AUJOURD'HUI.
 *
 * Écrit à la main dans le format EXACT que `zustand/persist` posait avant ce
 * changement — `{ "state": …, "version": n }`, le numéro que chaque magasin
 * déclarait — et non régénéré par le code de la branche : un instantané produit
 * par le nouveau magasin ne prouverait rien du tout. C'est la seule forme de
 * cette donnée qui existe sur les téléphones aujourd'hui.
 */
const ALICE = {
  id: 'p1',
  name: 'Alice',
  color: '#4a7c2a',
  createdAt: 1_700_000_000_000,
};
const BOB = {
  id: 'p2',
  name: 'Bob',
  color: '#d4892b',
  avatarBlobKey: 'avatar_p2_1700000000000',
  createdAt: 1_700_000_001_000,
};

const CONFIG = {
  players: [ALICE, BOB],
  targetScore: 50,
  overshootPenalty: 25,
  maxMisses: 3,
  missSanction: 'elimination',
  teamMode: 'solo',
  teams: [],
  variant: 'classic',
  shufflePlayers: false,
  handicaps: {},
};

const THROW = {
  id: 't1',
  playerId: 'p1',
  timestamp: 1_700_000_002_000,
  fallenPins: [12],
  computedScore: 12,
  resultedInElimination: false,
  resultedInOvershoot: false,
};

/** Une partie écrite par la version d'aujourd'hui : tous les champs y sont. */
const MATCH_RECENT = {
  id: 'm1',
  config: CONFIG,
  throws: [THROW],
  startedAt: 1_700_000_000_500,
  finishedAt: 1_700_000_600_000,
  winnerId: 'p1',
  ranking: [
    { playerId: 'p1', finalScore: 50, eliminated: false, rank: 1 },
    { playerId: 'p2', finalScore: 37, eliminated: false, rank: 2 },
  ],
  highlightedThrowIds: ['t1'],
  predictions: { p1: 'p1' },
};

/**
 * Une partie d'AVANT la v2 du magasin : ni `highlightedThrowIds` ni
 * `predictions`. C'est ce que l'ancienne chaîne de migrations rétro-remplissait,
 * et ce que le `legacy` du magasin versionné doit continuer de faire.
 */
const MATCH_ANCIENNE = {
  id: 'm0',
  config: CONFIG,
  throws: [],
  startedAt: 1_690_000_000_000,
  finishedAt: 1_690_000_600_000,
  winnerId: 'p2',
  ranking: [
    { playerId: 'p2', finalScore: 50, eliminated: false, rank: 1 },
    { playerId: 'p1', finalScore: 12, eliminated: false, rank: 2 },
  ],
};

const TEMPLATE = {
  id: 'tpl1',
  name: 'Apéro',
  targetScore: 50,
  overshootPenalty: 25,
  maxMisses: 3,
  missSanction: 'elimination',
  teamMode: 'solo',
  playerIds: ['p1', 'p2'],
  createdAt: 1_700_000_003_000,
};

const SETTINGS = {
  locale: 'en',
  sounds: false,
  vibrations: true,
  wakeLock: false,
  outdoor: true,
  colorblind: true,
  coach: false,
  voiceAnnouncer: true,
  hasSeenWelcome: true,
  hasSeenMatchOnboarding: true,
};

/** La forme que `zustand/persist` écrivait : enveloppe `{ state, version }`. */
function legacyEnvelope(state: unknown, version: number): string {
  return JSON.stringify({ state, version });
}

function poserInstantaneDAujourdhui(): void {
  localStorage.setItem(
    'mm_match',
    legacyEnvelope(
      { current: null, history: [MATCH_RECENT, MATCH_ANCIENNE] },
      3
    )
  );
  localStorage.setItem(
    'mm_players',
    legacyEnvelope({ players: [ALICE, BOB] }, 1)
  );
  localStorage.setItem(
    'mm_templates',
    legacyEnvelope({ templates: [TEMPLATE] }, 1)
  );
  localStorage.setItem('mm_settings', legacyEnvelope(SETTINGS, 1));
  localStorage.setItem(
    'mm_sync',
    legacyEnvelope({ enabled: true, lastSyncAt: '2026-09-01T10:00:00.000Z' }, 1)
  );
}

async function rehydraterTout(): Promise<void> {
  await Promise.all([
    useMatchStore.persist.rehydrate(),
    usePlayersStore.persist.rehydrate(),
    useTemplatesStore.persist.rehydrate(),
    useSettingsStore.persist.rehydrate(),
    useSyncStore.persist.rehydrate(),
  ]);
}

beforeEach(() => {
  localStorage.clear();
  useMatchStore.setState({ current: null, history: [], pendingFeedback: null });
  usePlayersStore.setState({ players: [] });
  useTemplatesStore.setState({ templates: [] });
  useSyncStore.setState({ enabled: false, lastSyncAt: null });
  useSettingsStore.getState().reset();
});

describe('persistance versionnée', () => {
  it('retrouve intégralement un instantané des clés mm_* d’aujourd’hui', async () => {
    poserInstantaneDAujourdhui();
    await rehydraterTout();

    // L'historique : les deux parties, dans l'ordre, avec leurs lancers,
    // leur classement, leurs étoiles et leurs pronostics.
    const history = useMatchStore.getState().history;
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      id: 'm1',
      winnerId: 'p1',
      throws: [THROW],
      ranking: MATCH_RECENT.ranking,
      highlightedThrowIds: ['t1'],
      predictions: { p1: 'p1' },
    });
    expect(history[0]?.config).toEqual(CONFIG);
    // La partie d'avant la v2 traverse la chaîne `legacy` : ses deux champs
    // manquants sont rétro-remplis, tout le reste est intact.
    expect(history[1]).toMatchObject({
      id: 'm0',
      winnerId: 'p2',
      highlightedThrowIds: [],
      predictions: {},
    });
    expect(history[1]?.ranking).toEqual(MATCH_ANCIENNE.ranking);

    // Le roster, y compris la clé d'avatar qui pointe vers IndexedDB.
    expect(usePlayersStore.getState().players).toEqual([ALICE, BOB]);

    // Les modèles de partie.
    expect(useTemplatesStore.getState().templates).toEqual([TEMPLATE]);

    // Les dix réglages, y compris ceux qui valent l'inverse du défaut.
    expect(useSettingsStore.getState()).toMatchObject(SETTINGS);

    // Le choix de synchro et la date du dernier échange.
    expect(useSyncStore.getState().enabled).toBe(true);
    expect(useSyncStore.getState().lastSyncAt).toBe('2026-09-01T10:00:00.000Z');
  });

  it('réécrit la clé sous l’enveloppe du socle, l’ancienne mise de côté', async () => {
    poserInstantaneDAujourdhui();
    const avant = localStorage.getItem('mm_match');
    await rehydraterTout();

    // La migration est PERSISTÉE dès la lecture : elle tourne une fois.
    const apres = JSON.parse(localStorage.getItem('mm_match') ?? 'null');
    expect(apres).toMatchObject({ v: 1 });
    expect(apres.data.history).toHaveLength(2);

    // Et la valeur d'origine est copiée AVANT la transformation, à l'octet
    // près : un retour en arrière du déploiement ne coûte rien.
    expect(localStorage.getItem('mm_match.backup-v0')).toBe(avant);
  });

  it('met de côté une valeur illisible au lieu de la jeter', async () => {
    // Une clé tronquée par un onglet tué en pleine écriture.
    localStorage.setItem('mm_players', '{"state":{"players":[{"id":"p1"');
    await rehydraterTout();

    expect(usePlayersStore.getState().players).toEqual([]);
    expect(localStorage.getItem('mm_players.backup-illisible')).toBe(
      '{"state":{"players":[{"id":"p1"'
    );
  });

  it('garde les enregistrements valides et met les autres de côté', async () => {
    localStorage.setItem(
      'mm_match',
      legacyEnvelope(
        {
          current: null,
          // Au milieu : une partie sans vainqueur ni classement, que le
          // schéma refuse. Elle ne doit pas emporter les deux autres.
          history: [
            MATCH_RECENT,
            { id: 'casse', config: CONFIG },
            MATCH_ANCIENNE,
          ],
        },
        3
      )
    );
    await rehydraterTout();

    const history = useMatchStore.getState().history;
    expect(history.map(m => m.id)).toEqual(['m1', 'm0']);

    const rejete = JSON.parse(
      localStorage.getItem('mm_match.rejete') ?? 'null'
    );
    expect(rejete.records).toHaveLength(1);
    expect(rejete.records[0]).toMatchObject({ id: 'casse' });
  });

  it('part des défauts quand rien n’est encore écrit', async () => {
    await rehydraterTout();

    expect(useMatchStore.getState().history).toEqual([]);
    expect(usePlayersStore.getState().players).toEqual([]);
    expect(useSettingsStore.getState().locale).toBe('fr');
    expect(useSyncStore.getState().enabled).toBe(false);
    // Une première ouverture ne met rien de côté : les copies de secours
    // coûtent de la place, elles ne se posent que devant une perte possible.
    const aside = Object.keys(localStorage).filter(
      k => k.includes('.backup-') || k.endsWith('.rejete')
    );
    expect(aside).toEqual([]);
  });
});
