import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { I18nProvider, LOCALE_STORAGE_KEY } from '../../i18n';
import {
  MatchConfigSchema,
  makePlayerId,
  type MatchConfig,
} from '../../schemas';
import { useMatchStore } from '../../store/useMatchStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useLiveStore } from '../../store/useLiveStore';
import {
  MEASURED_VOICES,
  clearSpoken,
  fakeSynth,
  installFakeSpeech,
  setVoices,
} from '../../test/fakeSpeech';
import { MatchView } from './MatchView';

/**
 * THE VOICE HAS TO REACH THE MATCH, not just the Settings screen.
 *
 * The picker and its trial button are covered by `SettingsView.voice.test.tsx`.
 * What this file owns is the part a user would notice last and blame hardest:
 * `MatchView` forwarding the chosen voice to the announcements it makes during
 * play. Dropping it there would look exactly like a setting that "doesn't
 * work", while the trial button in Settings kept sounding right.
 */

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

const CHOISIE = 'Microsoft Paul - French (France)';

describe('MatchView — the chosen voice reaches the announcements', () => {
  beforeAll(installFakeSpeech);

  beforeEach(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
    clearSpoken();
    setVoices(MEASURED_VOICES);
    useMatchStore.setState({
      current: null,
      history: [],
      pendingFeedback: null,
    });
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
    useSettingsStore.setState({ voiceAnnouncer: true, voiceName: CHOISIE });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    useSettingsStore.getState().reset();
    vi.restoreAllMocks();
  });

  /**
   * The turn announcement is deliberately skipped on the very first render —
   * speaking on mount feels intrusive — so the turn has to actually CHANGE.
   */
  it('announces the next player with the chosen voice', () => {
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));
    expect(fakeSynth.spoken, 'rien au montage').toHaveLength(0);

    act(() => {
      useMatchStore.getState().recordThrow([1]);
    });

    expect(fakeSynth.spoken).toHaveLength(1);
    expect(fakeSynth.spoken[0]?.text).toBe('À toi Bob.');
    expect(fakeSynth.spoken[0]?.voice?.name).toBe(CHOISIE);
  });

  it('says nothing at all while the announcer is off', () => {
    useSettingsStore.setState({ voiceAnnouncer: false });
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));

    act(() => {
      useMatchStore.getState().recordThrow([1]);
    });

    expect(fakeSynth.spoken).toHaveLength(0);
  });

  /** Sans choix, l'annonce part quand même : le socle décide de la voix. */
  it('still announces when no voice has been chosen', () => {
    useSettingsStore.setState({ voiceName: '' });
    useMatchStore.getState().startMatch(matchConfig());
    render(withProviders(<MatchView />));

    act(() => {
      useMatchStore.getState().recordThrow([1]);
    });

    expect(fakeSynth.spoken).toHaveLength(1);
    expect(fakeSynth.spoken[0]?.text).toBe('À toi Bob.');
  });
});
