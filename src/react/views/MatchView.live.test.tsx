import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { I18nProvider } from '../../i18n';
import {
  MatchConfigSchema,
  makePlayerId,
  type MatchConfig,
  type Throw,
} from '../../schemas';
import { useMatchStore } from '../../store/useMatchStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useLiveStore } from '../../store/useLiveStore';
import { MatchView } from './MatchView';

/**
 * CE QUE CE FICHIER TIENT : QUAND l'hôte clôt le direct, et AVEC QUOI.
 *
 * 1. Jamais pour une partie déjà archivée. La garde de la clôture partait de
 *    `null` : à l'ouverture du partage, la tête d'historique — une partie
 *    finie avant — passait pour « la partie qui vient de finir », et la partie
 *    à peine diffusée était gelée avec le vainqueur d'une autre.
 * 2. Avec le lancer gagnant. Ce lancer fait passer la partie de `current` à
 *    l'historique dans le même rendu : le miroir des lancers ne le voit jamais,
 *    c'est la clôture qui doit l'emporter.
 */

const ALICE = makePlayerId('p-a');

function matchConfig(): MatchConfig {
  return MatchConfigSchema.parse({
    players: [
      { id: ALICE, name: 'Alice', color: '#4a7c2a', createdAt: 1 },
      { id: makePlayerId('p-b'), name: 'Bob', color: '#d4892b', createdAt: 2 },
    ],
    targetScore: 50,
  });
}

/**
 * Alice vise la 12, Bob rate trois fois : éliminé, Alice gagne au sixième
 * lancer. Chaque lancer passe par son propre `act`, comme autant de touchers :
 * le miroir voit les cinq premiers.
 */
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

const realActions = {
  pushThrows: useLiveStore.getState().pushThrows,
  pushFinish: useLiveStore.getState().pushFinish,
};
const pushThrows = vi.fn<(throws: Throw[]) => Promise<void>>(() =>
  Promise.resolve()
);
const pushFinish = vi.fn<(winnerId: string, throws: Throw[]) => Promise<void>>(
  () => Promise.resolve()
);

/** L'hôte diffuse : les deux envois sont remplacés par des espions. */
function host() {
  useLiveStore.setState({
    role: 'host',
    hostToken: 'secret-hote',
    code: 'MZ7K2A',
    status: 'live',
    pushThrows,
    pushFinish,
  });
}

beforeEach(() => {
  pushThrows.mockClear();
  pushFinish.mockClear();
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
  useLiveStore.setState(realActions);
  vi.restoreAllMocks();
});

describe('MatchView et la clôture du direct', () => {
  it('ne clôt rien à l’ouverture du partage, même avec une partie archivée', () => {
    useMatchStore.getState().startMatch(matchConfig());
    playToTheEnd();
    expect(useMatchStore.getState().history).toHaveLength(1);

    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));
    act(() => host());

    expect(pushFinish).not.toHaveBeenCalled();
  });

  it('ne clôt rien non plus au retour sur l’écran en pleine diffusion', () => {
    useMatchStore.getState().startMatch(matchConfig());
    playToTheEnd();
    useMatchStore.getState().startMatch(matchConfig());
    host();

    render(withProviders(<MatchView />));

    expect(pushFinish).not.toHaveBeenCalled();
  });

  it('clôt la partie qui finit pendant la diffusion, lancer gagnant compris', () => {
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));
    act(() => host());

    playToTheEnd(true);

    expect(pushFinish).toHaveBeenCalledTimes(1);
    const [winnerId, throws] = pushFinish.mock.calls[0]!;
    expect(winnerId).toBe(ALICE);
    expect(throws).toHaveLength(6);
    // Le miroir a vu les cinq premiers lancers, jamais le sixième : seule la
    // clôture l'apporte aux spectateurs.
    const mirrored = pushThrows.mock.calls.map(([sent]) => sent.length);
    expect(Math.max(...mirrored)).toBe(5);
  });
});
