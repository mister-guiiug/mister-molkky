import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { I18nProvider } from '../../i18n/I18nProvider';
import { useMatchStore } from '../../store/useMatchStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTemplatesStore } from '../../store/useTemplatesStore';
import { useLiveStore } from '../../store/useLiveStore';
import { HomeView } from './HomeView';
import { MatchView } from './MatchView';
import { HistoryView } from './HistoryView';
import { StatsView } from './StatsView';
import { PlayersView } from './PlayersView';
import { SettingsView } from './SettingsView';
import { JoinLiveView } from './JoinLiveView';

function withProviders(ui: ReactElement, initialEntries: string[] = ['/']) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useMatchStore.setState({ current: null, history: [], pendingFeedback: null });
  usePlayersStore.setState({ players: [] });
  useTemplatesStore.setState({ templates: [] });
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
  // Suppress the welcome tutorial so HomeView's smoke test only deals
  // with the visible chrome — the tutorial modal would otherwise
  // duplicate the "Mister Mölkky" heading.
  useSettingsStore.getState().markWelcomeSeen();
  // Some hooks (PwaInstallPrompt, etc.) probe window APIs that the test
  // DOM doesn't implement; silence the warnings without hiding errors.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('view smoke tests — every route mounts without crashing', () => {
  it('HomeView renders the brand and "new match" CTA', () => {
    const { getByRole } = render(withProviders(<HomeView />));
    expect(
      getByRole('heading', { name: /Mister Mölkky/i })
    ).toBeInTheDocument();
    expect(
      getByRole('button', { name: /Nouvelle partie/i })
    ).toBeInTheDocument();
  });

  it('MatchView renders the empty-state when there is no active match', () => {
    const { getAllByText } = render(withProviders(<MatchView />));
    // "Rien à afficher" + the empty-state CTA "Nouvelle partie"
    expect(
      getAllByText(/Nouvelle partie|Rien à afficher/i).length
    ).toBeGreaterThan(0);
  });

  it('HistoryView renders the empty-history state', () => {
    const { getByText } = render(withProviders(<HistoryView />));
    expect(getByText(/Aucune partie terminée/i)).toBeInTheDocument();
  });

  it('StatsView renders the empty stats state', () => {
    const { getByText } = render(withProviders(<StatsView />));
    expect(getByText(/Pas encore de données/i)).toBeInTheDocument();
  });

  it('PlayersView renders the empty roster state', () => {
    const { getByText } = render(withProviders(<PlayersView />));
    expect(getByText(/Aucun joueur enregistré/i)).toBeInTheDocument();
  });

  it('SettingsView renders the main settings sections', () => {
    const { getAllByText, getByText } = render(withProviders(<SettingsView />));
    expect(getByText(/Thème/i)).toBeInTheDocument();
    // "Forcer la mise à jour" appears twice (section label + button) — use
    // getAllByText so the test isn't sensitive to that duplication.
    expect(getAllByText(/Forcer la mise à jour/i).length).toBeGreaterThan(0);
  });

  it('JoinLiveView mounts and shows the join heading', () => {
    const { getByRole } = render(
      withProviders(<JoinLiveView />, ['/rejoindre'])
    );
    // Heading is rendered both when Supabase is configured and when it
    // isn't, so it's the safest "mounted ok" check.
    expect(
      getByRole('heading', { name: /Rejoindre une partie/i })
    ).toBeInTheDocument();
  });
});
