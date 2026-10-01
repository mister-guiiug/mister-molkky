import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { GESTES } from '@mister-guiiug/dev-pwa-config/analytics';
import { I18nProvider } from '../../i18n';
import {
  MatchConfigSchema,
  makePlayerId,
  type MatchConfig,
} from '../../schemas';
import { useMatchStore } from '../../store/useMatchStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useLiveStore } from '../../store/useLiveStore';
import { MatchView } from './MatchView';

/**
 * CE QUE CE FICHIER TIENT : une partie finie = UNE mesure « terminee ».
 *
 * Le garde de la mesure partait de `null` : à chaque ouverture de cet écran,
 * la tête d'historique — une partie finie avant — passait pour « la partie
 * qui vient de finir ». Chaque visite comptait une fin de plus, et le nombre
 * de parties terminées gonflait chez tous ceux qui ont accepté la mesure.
 */

const { trackEvent } = vi.hoisted(() => ({
  trackEvent: vi.fn<(geste: string, props?: Record<string, unknown>) => void>(),
}));

// Seul l'envoi est remplacé : `GESTES` reste celui du socle.
vi.mock('@mister-guiiug/dev-pwa-config/analytics', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@mister-guiiug/dev-pwa-config/analytics')
  >()),
  trackEvent,
}));

function matchConfig(): MatchConfig {
  return MatchConfigSchema.parse({
    players: [
      {
        id: makePlayerId('p-a'),
        name: 'Alice',
        color: '#4a7c2a',
        createdAt: 1,
      },
      { id: makePlayerId('p-b'), name: 'Bob', color: '#d4892b', createdAt: 2 },
    ],
    targetScore: 50,
  });
}

/** Alice vise la 12, Bob rate trois fois : éliminé, Alice gagne. */
const SIX_THROWS: number[][] = [[12], [], [12], [], [12], []];

function playToTheEnd(eachInAct = false) {
  for (const pins of SIX_THROWS) {
    if (eachInAct) act(() => void useMatchStore.getState().recordThrow(pins));
    else useMatchStore.getState().recordThrow(pins);
  }
}

function withProviders(ui: ReactElement) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>
  );
}

/** Les fins comptées — les démarrages passent aussi par `trackEvent`. */
function finsMesurees() {
  return trackEvent.mock.calls.filter(
    ([geste, props]) => geste === GESTES.PARTIE && props?.etape === 'terminee'
  );
}

beforeEach(() => {
  trackEvent.mockClear();
  useMatchStore.setState({ current: null, history: [], pendingFeedback: null });
  usePlayersStore.setState({ players: [] });
  useLiveStore.setState({
    role: 'none',
    hostToken: null,
    code: null,
    remote: null,
    error: null,
    status: 'idle',
    subscription: null,
  });
  useSettingsStore.getState().reset();
  useSettingsStore.getState().markWelcomeSeen();
  useSettingsStore.getState().markMatchOnboardingSeen();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MatchView et la mesure de fin de partie', () => {
  it('ne compte rien à l’ouverture de l’écran, même avec une partie archivée', () => {
    useMatchStore.getState().startMatch(matchConfig());
    playToTheEnd();
    expect(useMatchStore.getState().history).toHaveLength(1);

    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));

    expect(finsMesurees()).toHaveLength(0);
  });

  it('ne recompte pas la partie finie au retour sur l’écran', () => {
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));
    playToTheEnd(true);
    expect(finsMesurees()).toHaveLength(1);

    cleanup();
    render(withProviders(<MatchView />));

    expect(finsMesurees()).toHaveLength(1);
  });

  it('compte une fois chaque partie qui finit sur l’écran, revanche comprise', () => {
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));

    playToTheEnd(true);
    expect(finsMesurees()).toEqual([
      [GESTES.PARTIE, { etape: 'terminee', direct: false }],
    ]);

    act(() => void useMatchStore.getState().startMatch(matchConfig()));
    playToTheEnd(true);

    expect(finsMesurees()).toHaveLength(2);
  });
});
