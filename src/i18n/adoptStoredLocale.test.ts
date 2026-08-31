import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La reprise du choix de langue déjà stocké.
 *
 * Ce qui se joue ici est une MIGRATION DE DONNÉES, pas une mécanique i18n : la
 * langue vivait dans le blob `mm_settings` et vit désormais sous `mm_locale`.
 * Le passage n'a lieu qu'une fois, au chargement du module — d'où le
 * `resetModules()` avant chaque import.
 *
 * Sans elle, la première ouverture après mise à jour remettrait en français
 * tout utilisateur ayant choisi l'anglais. Une seule fois, sans erreur : le
 * genre de régression que personne ne remonte.
 */

const LOCALE_KEY = 'mm_locale';
const SETTINGS_KEY = 'mm_settings';

/** Recharge `./index` à froid : c'est l'import qui déclenche la reprise. */
async function loadI18nModule() {
  vi.resetModules();
  return import('./index');
}

beforeEach(() => {
  localStorage.clear();
});

describe('reprise du choix de langue', () => {
  it('recopie la langue du blob des réglages sous sa propre clé', async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ state: { locale: 'en' }, version: 1 })
    );

    await loadI18nModule();

    expect(localStorage.getItem(LOCALE_KEY)).toBe('en');
  });

  it("n'écrase pas un choix déjà exprimé sous la nouvelle clé", async () => {
    localStorage.setItem(LOCALE_KEY, 'en');
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ state: { locale: 'fr' }, version: 1 })
    );

    await loadI18nModule();

    expect(localStorage.getItem(LOCALE_KEY)).toBe('en');
  });

  it('ignore un blob illisible plutôt que de lever', async () => {
    localStorage.setItem(SETTINGS_KEY, 'pas du JSON');

    await expect(loadI18nModule()).resolves.toBeDefined();

    expect(localStorage.getItem(LOCALE_KEY)).toBeNull();
  });

  it('ignore une langue inconnue du dictionnaire', async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ state: { locale: 'es' }, version: 1 })
    );

    await loadI18nModule();

    expect(localStorage.getItem(LOCALE_KEY)).toBeNull();
  });

  it("ne pose rien quand aucun réglage n'a jamais été enregistré", async () => {
    await loadI18nModule();

    expect(localStorage.getItem(LOCALE_KEY)).toBeNull();
  });
});
