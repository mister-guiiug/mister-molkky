import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider, LOCALE_STORAGE_KEY } from '../../../i18n';
import { AppFooter } from './AppFooter';

/**
 * Le pied de page doit offrir une PORTE DE SORTIE : dire quelle version tourne
 * et emmener vers `issues/new` avec le gabarit du compte déjà rempli. Les deux
 * props existaient dans le socle depuis la 4.4.0 sans que cette app les pose —
 * c'est exactement ce qu'un test attrape, et ce qu'aucun `npm run build` ne
 * pouvait signaler.
 */
/** La seule porte par laquelle le socle lit le build (`version.js`). */
const buildGlobal = globalThis as { __DWC_BUILD__?: unknown };

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
  // Ce que `vite-version` pose dans la page au build ; sous Vitest il n'y a
  // pas de build, donc on le pose à la main pour éprouver le vrai chemin.
  buildGlobal.__DWC_BUILD__ = {
    version: '1.4.2',
    commit: 'abcdef1234567890',
    buildTime: '2026-09-06T12:00:00.000Z',
    base: '/mister-molkky/',
  };
});

afterEach(() => {
  cleanup();
  delete buildGlobal.__DWC_BUILD__;
  localStorage.clear();
});

describe('AppFooter', () => {
  it('emmène vers le gabarit bug.yml du dépôt, version et écran remplis', () => {
    render(
      <I18nProvider>
        <AppFooter />
      </I18nProvider>
    );

    const link = screen.getByRole('link', { name: /signaler un problème/i });
    const href = new URL(link.getAttribute('href') ?? '');
    expect(href.origin + href.pathname).toBe(
      'https://github.com/mister-guiiug/mister-molkky/issues/new'
    );
    expect(href.searchParams.get('template')).toBe('bug.yml');
    // Ce qui distingue ce lien d'un raccourci vers l'onglet Issues : la
    // version et le commit y sont DÉJÀ, l'utilisateur n'a pas à les chercher.
    expect(href.searchParams.get('version')).toContain('1.4.2');
    expect(href.searchParams.get('version')).toContain('abcdef1');
    expect(href.searchParams.get('environnement')).toContain('écran');
  });

  it('affiche le numéro de version du build', () => {
    render(
      <I18nProvider>
        <AppFooter />
      </I18nProvider>
    );

    expect(screen.getByText(/1\.4\.2/)).toBeInTheDocument();
  });
});
