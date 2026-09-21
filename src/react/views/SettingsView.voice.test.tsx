import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { I18nProvider, LOCALE_STORAGE_KEY } from '../../i18n';
import { makePlayerId } from '../../schemas';
import { usePlayersStore } from '../../store/usePlayersStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import {
  MEASURED_VOICES,
  clearSpoken,
  fakeSynth,
  installFakeSpeech,
  setVoices,
} from '../../test/fakeSpeech';
import { SettingsView } from './SettingsView';

/**
 * PICKING THE ANNOUNCER'S VOICE.
 *
 * Nothing in `SpeechSynthesisVoice` says how well a voice articulates, and some
 * do it badly: measured 21/09/2026 on Firefox 156 / Windows, `Microsoft
 * Hortense` — the FIRST French voice on that machine, hence the one the socle
 * picks by default — mangles words that follow punctuation, while `Julie` and
 * `Paul` read the same sentences correctly.
 *
 * On Firefox no voice carries `default: true` either, so the app cannot follow
 * the system choice and the user has no way out at all. These tests hold an
 * escape hatch, not a comfort.
 */

function withProviders(ui: ReactElement) {
  return (
    <MemoryRouter>
      <I18nProvider>{ui}</I18nProvider>
    </MemoryRouter>
  );
}

const ALICE = {
  id: makePlayerId('p1'),
  name: 'Alice',
  color: '#4a7c2a',
  createdAt: 1_700_000_000_000,
};

/** « Annonceur vocal » paraît deux fois : titre de section ET libellé. */
const annonceurVisible = () =>
  screen.getAllByText(/Annonceur vocal/i).length > 0;

describe('SettingsView — announcer voice', () => {
  beforeAll(installFakeSpeech);

  beforeEach(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
    clearSpoken();
    setVoices(MEASURED_VOICES);
    usePlayersStore.setState({ players: [ALICE] });
    useSettingsStore.getState().reset();
    useSettingsStore.setState({ voiceAnnouncer: true, voiceName: '' });
  });

  afterEach(() => {
    cleanup();
    useSettingsStore.getState().reset();
    usePlayersStore.setState({ players: [] });
  });

  it('stays hidden while the announcer is off', () => {
    useSettingsStore.setState({ voiceAnnouncer: false });
    render(withProviders(<SettingsView />));
    expect(annonceurVisible()).toBe(true);
    expect(screen.queryByLabelText(/Voix de l/i)).toBeNull();
  });

  it('offers the automatic choice and every voice', () => {
    render(withProviders(<SettingsView />));
    const select = screen.getByLabelText(/Voix de l/i) as HTMLSelectElement;
    expect([...select.options].map(o => o.textContent)).toEqual([
      'Automatique',
      ...MEASURED_VOICES.map(v => v.name),
    ]);
    expect(select.value).toBe('');
  });

  it('offers nothing when there is no choice to make', () => {
    setVoices(MEASURED_VOICES.slice(0, 1));
    render(withProviders(<SettingsView />));
    expect(annonceurVisible()).toBe(true);
    expect(screen.queryByLabelText(/Voix de l/i)).toBeNull();
  });

  it('remembers the chosen voice', () => {
    render(withProviders(<SettingsView />));
    fireEvent.change(screen.getByLabelText(/Voix de l/i), {
      target: { value: 'Microsoft Paul - French (France)' },
    });
    expect(useSettingsStore.getState().voiceName).toBe(
      'Microsoft Paul - French (France)'
    );
  });

  /**
   * THE TEST THAT MATTERS HERE. It holds the whole chain — dropdown, store,
   * `tts`, socle — and checks the trial speaks a REAL announcement with a REAL
   * name: a mangled name is exactly what would bother you, and a generic demo
   * sentence would not let you hear it.
   */
  it('tries the chosen voice on a real announcement, with a real name', () => {
    render(withProviders(<SettingsView />));
    fireEvent.change(screen.getByLabelText(/Voix de l/i), {
      target: { value: 'Microsoft Julie - French (France)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Écouter/i }));

    expect(fakeSynth.spoken).toHaveLength(1);
    const spoken = fakeSynth.spoken[0] as {
      text: string;
      lang: string;
      voice: SpeechSynthesisVoice | null;
    };
    expect(spoken.text).toBe('À toi Alice.');
    expect(spoken.lang).toBe('fr-FR');
    expect(spoken.voice?.name).toBe('Microsoft Julie - French (France)');
  });

  /** Sans joueur enregistré, on annonce le dépassement plutôt qu'un prénom inventé. */
  it('falls back to a nameless announcement when the roster is empty', () => {
    usePlayersStore.setState({ players: [] });
    render(withProviders(<SettingsView />));
    fireEvent.click(screen.getByRole('button', { name: /Écouter/i }));
    expect(fakeSynth.spoken[0]?.text).toBe('Dépassement.');
  });

  /**
   * `getVoices()` returns an EMPTY array on its first call: without the
   * `voiceschanged` subscription the setting would stay invisible forever on
   * browsers that load their voices after mount.
   */
  it('appears when the voices arrive after mount', async () => {
    setVoices([]);
    render(withProviders(<SettingsView />));
    expect(screen.queryByLabelText(/Voix de l/i)).toBeNull();

    setVoices(MEASURED_VOICES);
    expect(await screen.findByLabelText(/Voix de l/i)).toBeInTheDocument();
  });
});
