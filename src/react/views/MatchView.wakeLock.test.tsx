import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
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
import { HomeView } from './HomeView';

/**
 * Usage du verrou d'écran, pas sa mécanique : la ré-acquisition au retour au
 * premier plan, le silence quand l'API manque et la course « demande aboutie
 * après le démontage » appartiennent au socle
 * (`@mister-guiiug/dev-pwa-config/react/use-wake-lock`). Ce qui est propre à
 * Mölkky, c'est *quand* le verrou est demandé : partie en cours **et** réglage
 * « Garder l'écran allumé en partie » activé.
 */

const release = vi.fn(() => Promise.resolve());
const request = vi.fn(() => Promise.resolve({ released: false, release }));

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

function withProviders(ui: ReactElement) {
  return (
    <MemoryRouter initialEntries={['/']}>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  release.mockClear();
  request.mockClear();
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
  });
  useMatchStore.setState({ current: null, history: [], pendingFeedback: null });
  usePlayersStore.setState({ players: [] });
  useLiveStore.setState({
    role: 'none',
    matchId: null,
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
  Reflect.deleteProperty(navigator, 'wakeLock');
  vi.restoreAllMocks();
});

describe('MatchView et le verrou d’écran', () => {
  it('demande le verrou quand une partie est en cours', async () => {
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
  });

  it('ne demande rien quand aucune partie n’est en cours', () => {
    render(withProviders(<MatchView />));
    expect(request).not.toHaveBeenCalled();
  });

  it('ne demande rien sur l’écran d’accueil', () => {
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<HomeView />));
    expect(request).not.toHaveBeenCalled();
  });

  it('respecte le réglage « garder l’écran allumé » désactivé', () => {
    useSettingsStore.getState().toggleWakeLock();
    expect(useSettingsStore.getState().wakeLock).toBe(false);
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));
    expect(request).not.toHaveBeenCalled();
  });

  it('relâche le verrou quand la partie est quittée', async () => {
    useMatchStore.getState().startMatch(matchConfig());
    const { unmount } = render(withProviders(<MatchView />));
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    unmount();
    await vi.waitFor(() => expect(release).toHaveBeenCalled());
  });
});
