import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Suspense, lazy, type ComponentType } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider, LOCALE_STORAGE_KEY } from '../../../i18n';
import { ROUTES } from '../../../routes';
import { Shell } from './Shell';

/**
 * LE DÉFAUT QUE CES TESTS VERROUILLENT : un clic sans aucun effet visible.
 *
 * Diagnostiqué sur miss-badminton le 20/09/2026 (PR #80), puis retrouvé ici.
 * Mesuré sur https://mister-guiiug.github.io/mister-molkky/ à la première
 * visite, service worker pas encore installé : le clic sur « Joueurs » demande
 * `PlayersView` (2 039 octets) et coûte 161 ms d'aller-retour réseau. Pendant
 * ces 161 ms l'URL disait déjà `/players` et l'écran montrait encore l'accueil.
 *
 * La cause n'est pas une lenteur anormale : react-router 7 enveloppe tout
 * changement d'URL dans `startTransition`, et React 19 garde alors
 * délibérément l'écran déjà affiché plutôt que de montrer le repli de
 * `Suspense`. Le repli existait bien, dans `AppRouter` — il n'a simplement
 * jamais pu paraître sur un clic : 188 échantillons du DOM toutes les 16 ms,
 * `aria-busy` faux d'un bout à l'autre, zéro apparition.
 *
 * Ces tests tiennent donc le CONTRAT, pas la mise en forme : tant que la vue
 * n'est pas là, l'entrée cliquée se dit occupée et le menu reste à l'écran
 * pour le montrer.
 */

/** Monte la coquille face à une vue dont on décide nous-même de l'arrivée. */
function monterFaceAUneVueLente() {
  let resous!: () => void;
  const VueLente = lazy(
    () =>
      new Promise<{ default: ComponentType }>(resolve => {
        resous = () => resolve({ default: () => <h1>Les joueurs</h1> });
      })
  );

  render(
    <MemoryRouter initialEntries={[ROUTES.home]}>
      <I18nProvider>
        <Shell>
          <Suspense fallback={<p>repli de route</p>}>
            <Routes>
              <Route path={ROUTES.home} element={<h1>Accueil</h1>} />
              <Route path={ROUTES.players} element={<VueLente />} />
            </Routes>
          </Suspense>
        </Shell>
      </I18nProvider>
    </MemoryRouter>
  );

  return {
    entree: (nom: string) => screen.getByRole('link', { name: nom }),
    /** Fait arriver le morceau, et laisse React repeindre. */
    livreLaVue: async () => {
      await act(async () => {
        resous();
      });
    },
  };
}

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('le clic sur une entrée du menu répond avant que la vue soit là', () => {
  it("dit l'entrée occupée tant que le morceau n'est pas arrivé", async () => {
    const { entree, livreLaVue } = monterFaceAUneVueLente();

    fireEvent.click(entree('Joueurs'));

    expect(entree('Joueurs')).toHaveAttribute('aria-busy', 'true');
    // Les autres entrées, elles, ne se disent pas occupées : c'est bien celle
    // qu'on a cliquée qui travaille, pas le menu entier.
    expect(entree('Accueil')).not.toHaveAttribute('aria-busy');

    await livreLaVue();

    expect(
      screen.getByRole('heading', { name: 'Les joueurs' })
    ).toBeInTheDocument();
    expect(entree('Joueurs')).not.toHaveAttribute('aria-busy');
  });

  it('annonce le chargement dans une zone vive, hors des liens', async () => {
    const { entree, livreLaVue } = monterFaceAUneVueLente();

    expect(screen.getByRole('status')).toHaveTextContent('');
    fireEvent.click(entree('Joueurs'));

    // HORS des liens : le nom accessible de « Joueurs » ne doit pas changer en
    // cours de route sous le doigt d'un lecteur d'écran.
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…');
    expect(entree('Joueurs')).toHaveAccessibleName('Joueurs');

    await livreLaVue();

    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it("garde l'écran précédent ET le menu pendant l'attente", async () => {
    const { entree, livreLaVue } = monterFaceAUneVueLente();

    fireEvent.click(entree('Joueurs'));

    // CE QUE LE REPLI DE `Suspense` NE FERA PAS. React 19 garde l'écran déjà
    // affiché pendant la transition ouverte par react-router : l'accueil est
    // toujours là, et le repli de route n'a pas paru. C'est très exactement
    // pourquoi le menu doit parler — lui seul le peut.
    expect(
      screen.getByRole('heading', { name: 'Accueil' })
    ).toBeInTheDocument();
    expect(screen.queryByText('repli de route')).toBeNull();

    // Et le menu reste sous les yeux pour le montrer. Mölkky n'a pas de
    // tiroir à refermer (contrairement à badminton, PR #80), mais la règle est
    // la même : ce qui dit « je charge » doit survivre au clic.
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(entree('Joueurs')).toHaveAttribute('aria-busy', 'true');

    await livreLaVue();

    expect(screen.queryByRole('heading', { name: 'Accueil' })).toBeNull();
  });

  it('laisse le navigateur faire quand le clic porte un modificateur', () => {
    const { entree } = monterFaceAUneVueLente();

    fireEvent.click(entree('Joueurs'), { ctrlKey: true });

    // Ouvrir dans un nouvel onglet n'est pas une navigation de cette page :
    // rien ne doit être mis en attente ici.
    expect(entree('Joueurs')).not.toHaveAttribute('aria-busy');
    expect(
      screen.getByRole('heading', { name: 'Accueil' })
    ).toBeInTheDocument();
  });
});
