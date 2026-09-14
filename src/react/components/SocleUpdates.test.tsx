import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * LE `vi.unmock` EST INDISPENSABLE, et il n'est pas décoratif.
 *
 * `@mister-guiiug/dev-pwa-config/vitest-setup` — chargé par `baseTestOptions`
 * pour TOUS les fichiers de test — pose un
 * `vi.mock('virtual:pwa-register', () => ({ registerSW: () => () => {} }))`.
 * Ce mock est résolu à travers le `resolve.alias` de `vitest.config.ts` : il
 * s'applique donc au MÊME fichier que le double pilotable du socle, et
 * l'écrase. Sans cette ligne, importer `swStub` échoue avec « No "swStub"
 * export is defined on the "virtual:pwa-register" mock », et un test de
 * bandeau retomberait sur un `registerSW` muet — c'est-à-dire sur exactement
 * le faux témoin que `testing/pwa-register` existe pour supprimer.
 */
vi.unmock('virtual:pwa-register');

import { swStub } from '@mister-guiiug/dev-pwa-config/testing/pwa-register';
import { LabelsProvider } from '@mister-guiiug/dev-pwa-config/react/labels';
import { SocleUpdates } from './SocleUpdates';

function renderApp(locale: 'fr' | 'en' = 'fr') {
  return render(
    <LabelsProvider locale={locale}>
      <SocleUpdates>
        <p>contenu</p>
      </SocleUpdates>
    </LabelsProvider>
  );
}

describe('SocleUpdates', () => {
  beforeEach(() => {
    // `reset()` rend une identité NEUVE à `registerSW` : `useUpdatePrompt`
    // mémorise sa connexion par identité de fonction (WeakMap), donc sans ça
    // le `needRefresh` d'un test survivrait au suivant.
    swStub.reset();
    vi.unstubAllEnvs();
  });

  it("n'enregistre rien en développement, et le dit", () => {
    // `import.meta.env.DEV` vaut vrai sous Vitest : c'est le cas nominal ici.
    renderApp();

    expect(swStub.registered).toBe(false);
    // LA CONTRE-ÉPREUVE. Le double LÈVE au lieu de ne rien faire : sans
    // `registerSW` injecté, le bandeau est structurellement incapable de
    // s'afficher, et le test le dit au lieu de passer en silence.
    expect(() => swStub.needRefresh()).toThrow(
      /registerSW n'a jamais été appelé/
    );
  });

  it('enregistre le service worker hors développement', () => {
    vi.stubEnv('DEV', false);
    renderApp();

    expect(swStub.registered).toBe(true);
    // `immediate` vient de `useUpdatePrompt` : sans lui, l'enregistrement
    // attend l'évènement `load`.
    expect(swStub.options).toMatchObject({ immediate: true });
  });

  it('affiche le bandeau quand une nouvelle version attend', () => {
    vi.stubEnv('DEV', false);
    renderApp();

    // Rien tant que le service worker n'a pas parlé.
    expect(screen.queryByRole('status')).toBeNull();

    // Ce que fait un vrai service worker quand une version attend.
    act(() => {
      swStub.needRefresh();
    });

    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('data-dwc', 'update-banner');
    expect(banner).toHaveTextContent('Mise à jour disponible');
    // Le bandeau maison n'avait qu'un bouton : qui ne voulait pas recharger
    // tout de suite n'avait aucune sortie. On vérifie donc qu'il y en a DEUX,
    // par leur crochet stable et non par leur libellé : celui du bouton de mise
    // à jour appartient au socle, qui l'a déjà changé une fois — « Recharger »
    // est devenu « Mettre à jour » en 4.16.0, et ce test-ci a rougi pour un
    // mot, pas pour un comportement.
    expect(
      banner.querySelector('[data-dwc="update-banner-update"]')
    ).not.toBeNull();
    expect(
      banner.querySelector('[data-dwc="update-banner-dismiss"]')
    ).not.toBeNull();
  });

  it('traduit le bandeau, ce que le bandeau maison ne pouvait pas faire', () => {
    // L'ancien bandeau était fabriqué en DOM brut AVANT React, donc hors de
    // tout contexte i18n, avec « Une nouvelle version est disponible. » codé
    // en dur. Mölkky est bilingue fr/en, et le socle livre ces deux locales.
    vi.stubEnv('DEV', false);
    renderApp('en');

    act(() => {
      swStub.needRefresh();
    });

    // Ce qu'on éprouve ici, c'est que le bandeau SUIT LA LOCALE — pas qu'il dit
    // tel mot. Le titre le montre déjà ; le libellé des boutons appartient au
    // socle, et le figer ferait rougir ce test à chaque reformulation, comme
    // c'est arrivé en 4.16.0. On vérifie donc que le bouton est là et qu'il
    // porte un libellé, pas lequel.
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Update available');
    const maj = banner.querySelector('[data-dwc="update-banner-update"]');
    expect(maj?.textContent?.trim()).toBeTruthy();
  });
});
