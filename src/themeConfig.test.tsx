import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ThemeProvider } from '@mister-guiiug/dev-wpa-config/react';
// `?raw` plutôt que `node:fs` : le projet TypeScript de l'app n'embarque pas
// les types Node, et cet import-là est déjà typé par `vite/client`.
import viteConfigSource from '../vite.config.ts?raw';
import { THEME_COLOR, THEME_LEGACY_KEYS } from './themeConfig';

/**
 * La garantie qui compte pour l'utilisateur, et que rien ne couvrait.
 *
 * Le socle stocke le thème sous `dwc_theme` ; Mister Mölkky stockait sous
 * `mm_theme`. Adopter `useTheme` sans reprendre l'ancienne clé orpheline la
 * préférence de chaque utilisateur déjà installé : au premier chargement l'app
 * « oublie » son thème sombre, une seule fois, sans erreur ni trace.
 *
 * Le stub `matchMedia` du setup partagé répond `matches: false`, donc `system`
 * se résout en clair : une reprise ratée se voit sur une préférence SOMBRE.
 */

/** Ce que `main.tsx` monte, sans le reste de l'arbre. */
function mount(props: { legacyKeys?: string[] } = {}) {
  return render(
    <ThemeProvider legacyKeys={props.legacyKeys} themeColor={THEME_COLOR}>
      <span>contenu</span>
    </ThemeProvider>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.querySelector('meta[data-dwc="theme-color"]')?.remove();
});

describe('reprise de la préférence de thème', () => {
  it('démarre en sombre quand la préférence était stockée sous mm_theme', () => {
    localStorage.setItem('mm_theme', 'dark');

    mount({ legacyKeys: THEME_LEGACY_KEYS });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('réécrit la préférence sous la clé du socle, une seule fois', () => {
    localStorage.setItem('mm_theme', 'dark');

    mount({ legacyKeys: THEME_LEGACY_KEYS });

    expect(localStorage.getItem('dwc_theme')).toBe('dark');
  });

  it('témoin : sans reprise, la même préférence est perdue', () => {
    localStorage.setItem('mm_theme', 'dark');

    // Sans `legacyKeys`, `dwc_theme` est vide → défaut `system` → le stub
    // matchMedia répond « pas sombre » → clair. C'est le bug silencieux.
    mount();

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('reprend aussi « system », que l’ancien écran savait stocker', () => {
    localStorage.setItem('mm_theme', 'system');

    mount({ legacyKeys: THEME_LEGACY_KEYS });

    expect(localStorage.getItem('dwc_theme')).toBe('system');
  });

  it('un choix déjà migré prime sur la valeur restée dans mm_theme', () => {
    localStorage.setItem('mm_theme', 'dark');
    localStorage.setItem('dwc_theme', 'light');

    mount({ legacyKeys: THEME_LEGACY_KEYS });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  /**
   * L'ancien `applyTheme` allait chercher `meta[name="theme-color"]` pour en
   * réécrire le `content`. C'est `ThemeProvider` qui s'en charge : sans les
   * mêmes couleurs, la barre du navigateur cesserait de suivre le thème.
   */
  it('la barre du navigateur suit le schéma affiché', () => {
    localStorage.setItem('mm_theme', 'dark');

    mount({ legacyKeys: THEME_LEGACY_KEYS });

    const meta = document.querySelector('meta[data-dwc="theme-color"]');
    expect(meta?.getAttribute('content')).toBe(THEME_COLOR.dark);
  });

  /**
   * Le script anti-FOUC reçoit les mêmes anciennes clés, mais depuis
   * `vite.config.ts`, qui s'exécute côté Node et ne peut pas importer ce
   * module. Deux listes divergentes = le script pose un thème que React
   * repeint aussitôt, soit le scintillement que le script existe pour
   * supprimer. Rien d'autre ne surveille cet accord.
   */
  it('le script anti-FOUC déclare les mêmes anciennes clés', () => {
    for (const key of THEME_LEGACY_KEYS) {
      expect(viteConfigSource).toContain(`legacyKeys: ['${key}']`);
    }
    expect(viteConfigSource).toContain(`light: '${THEME_COLOR.light}'`);
    expect(viteConfigSource).toContain(`dark: '${THEME_COLOR.dark}'`);
  });
});
