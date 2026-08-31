import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, LOCALE_STORAGE_KEY, useI18n } from './index';
import { LocaleSync } from './LocaleSync';
import { useSettingsStore } from '../store/useSettingsStore';

/**
 * Le pont entre la langue AFFICHÉE (socle) et la langue SYNCHRONISÉE (magasin
 * de réglages, poussée et tirée par `cloudSync`).
 *
 * Ces deux tests sont la raison d'être de `LocaleSync` : sans lui, chacun des
 * deux sens tombe en panne silencieusement — l'écran ignore une sauvegarde
 * tirée du nuage, et le nuage ignore le choix de l'utilisateur.
 */

function Probe() {
  const { locale, setLocale } = useI18n();
  return (
    <>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={() => setLocale('en')}>
        passer en anglais
      </button>
    </>
  );
}

function mount() {
  return render(
    <I18nProvider>
      <LocaleSync>
        <Probe />
      </LocaleSync>
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  // Point de départ explicite : sans clé, le provider suivrait
  // `navigator.language` (`en-US` sous jsdom) et les deux tests partiraient
  // déjà en anglais.
  localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
  useSettingsStore.getState().reset();
});

afterEach(cleanup);

describe('LocaleSync', () => {
  it('applique à l’écran une langue arrivée par le magasin (tirage nuage)', () => {
    mount();
    expect(screen.getByTestId('locale')).toHaveTextContent('fr');

    // Ce que fait `applyPayload()` de useSyncStore, hors de tout composant.
    act(() => {
      useSettingsStore.setState({ locale: 'en' });
    });

    expect(screen.getByTestId('locale')).toHaveTextContent('en');
  });

  it("reporte dans le magasin le choix de l'utilisateur (prochain envoi)", () => {
    mount();
    expect(useSettingsStore.getState().locale).toBe('fr');

    act(() => {
      screen.getByRole('button', { name: /anglais/i }).click();
    });

    expect(screen.getByTestId('locale')).toHaveTextContent('en');
    expect(useSettingsStore.getState().locale).toBe('en');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  });
});
