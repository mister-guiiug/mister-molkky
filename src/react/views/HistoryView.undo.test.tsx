import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@mister-guiiug/dev-pwa-config/react/toast';
import { I18nProvider, LOCALE_STORAGE_KEY } from '../../i18n';
import { useMatchStore } from '../../store/useMatchStore';
import {
  FinishedMatchSchema,
  PlayerSchema,
  type FinishedMatch,
} from '../../schemas';
import { HistoryView } from './HistoryView';

/**
 * SUPPRIMER, ANNULER, RETROUVER (V12 de VALEUR.md).
 *
 * Ce que ces tests éprouvent n'est pas la notification : c'est que la partie
 * SORT de l'historique au clic, et qu'elle y REVIENT — à sa place
 * chronologique — quand l'utilisateur se ravise. Le `ConfirmDialog` qu'ils
 * remplacent ne prouvait rien de tel : il posait une question, et « oui »
 * était définitif.
 *
 * `docs/cloud-sync.md` s'appuie sur ce comportement pour assumer que la
 * suppression ne se propage pas d'un appareil à l'autre — « une suppression qui
 * revient est une gêne, une partie qui disparaît est une perte ». Une promesse
 * écrite dans une documentation et nulle part ailleurs est exactement ce que
 * V1 reproche à l'app voisine.
 */
const ALICE = PlayerSchema.parse({
  id: 'p1',
  name: 'Alice',
  color: '#4a7c2a',
  createdAt: 1_000,
});
const BOB = PlayerSchema.parse({
  id: 'p2',
  name: 'Bob',
  color: '#2a4a7c',
  createdAt: 2_000,
});

function match(id: string, finishedAt: number): FinishedMatch {
  return FinishedMatchSchema.parse({
    id,
    config: {
      players: [ALICE, BOB],
      targetScore: 50,
      overshootPenalty: 25,
      maxMisses: 3,
      teams: [],
      handicaps: {},
    },
    throws: [],
    startedAt: finishedAt - 600_000,
    finishedAt,
    winnerId: 'p1',
    ranking: [
      { playerId: 'p1', finalScore: 50, eliminated: false, rank: 1 },
      { playerId: 'p2', finalScore: 30, eliminated: false, rank: 2 },
    ],
  });
}

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={['/history']}>
      <I18nProvider>
        <ToastProvider duration={8000}>
          <HistoryView />
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

function historyIds(): string[] {
  return useMatchStore.getState().history.map(m => m.id);
}

beforeEach(() => {
  // Les attentes sont écrites en français : la langue est fixée, pas subie.
  localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
  useMatchStore.setState({ current: null, history: [], pendingFeedback: null });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('historique — supprimer, annuler', () => {
  it('supprime sans question préalable, puis rend la partie à l’annulation', () => {
    useMatchStore.setState({
      history: [match('m2', 2_000_000), match('m1', 1_000_000)],
    });
    renderHistory();

    // La plus ancienne des deux — celle du bas — puis « Supprimer ». AUCUN
    // dialogue ne s'interpose : c'est le point du chantier.
    const rows = screen.getAllByRole('button', { name: /Alice gagne/i });
    expect(rows).toHaveLength(2);
    fireEvent.click(rows[1]!);
    fireEvent.click(screen.getByRole('button', { name: /^Supprimer$/ }));

    expect(historyIds()).toEqual(['m2']);
    expect(screen.getByText('Partie supprimée')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Annuler la suppression' })
    );

    // Revenue, et à sa place chronologique — pas empilée en tête de liste.
    expect(historyIds()).toEqual(['m2', 'm1']);
    expect(screen.getByText('Action annulée')).toBeInTheDocument();
  });

  it('rend tout l’historique d’un « tout effacer » annulé', () => {
    useMatchStore.setState({
      history: [match('m2', 2_000_000), match('m1', 1_000_000)],
    });
    renderHistory();

    // Là, la question reste posée : le geste emporte jusqu'à deux cents
    // parties d'un coup. L'annulation s'y ajoute, elle ne la remplace pas.
    fireEvent.click(screen.getByRole('button', { name: /Tout effacer/i }));
    // Le dialogue `destructive` du socle nomme sa validation « Supprimer »,
    // pas « Confirmer » : la feuille de détail n'étant pas ouverte, c'est ici
    // le seul bouton qui porte ce nom.
    fireEvent.click(screen.getByRole('button', { name: /^Supprimer$/ }));

    expect(historyIds()).toEqual([]);
    expect(screen.getByText('2 partie(s) supprimée(s)')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Annuler la suppression' })
    );

    expect(historyIds()).toEqual(['m2', 'm1']);
  });

  it('supprimer deux parties laisse DEUX annulations, une par partie', () => {
    useMatchStore.setState({
      history: [match('m2', 2_000_000), match('m1', 1_000_000)],
    });
    renderHistory();

    for (const _ of [0, 1]) {
      const row = screen.getAllByRole('button', { name: /Alice gagne/i })[0]!;
      fireEvent.click(row);
      fireEvent.click(screen.getByRole('button', { name: /^Supprimer$/ }));
    }
    expect(historyIds()).toEqual([]);

    // Deux notifications empilées, chacune sur SA partie : un identifiant de
    // notification stable aurait remplacé la première et rendu m2
    // irrattrapable.
    const undos = screen.getAllByRole('button', {
      name: 'Annuler la suppression',
    });
    expect(undos).toHaveLength(2);
    fireEvent.click(undos[0]!);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Annuler la suppression' })[0]!
    );

    expect(historyIds()).toEqual(['m2', 'm1']);
  });

  it('annuler deux fois ne duplique pas la partie', () => {
    useMatchStore.setState({ history: [match('m2', 2_000_000)] });
    const restored = match('m1', 1_000_000);

    useMatchStore.getState().restoreHistory([restored]);
    useMatchStore.getState().restoreHistory([restored]);

    expect(historyIds()).toEqual(['m2', 'm1']);
  });
});
