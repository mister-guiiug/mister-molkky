import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LabelsProvider } from '@mister-guiiug/dev-wpa-config/react/labels';
import { I18nProvider } from '../../i18n';
import { useLiveStore } from '../../store/useLiveStore';
import { useMatchStore } from '../../store/useMatchStore';
import { LiveShareSheet } from './LiveShareSheet';

/**
 * CE QUE CE TEST TIENT — l'USAGE du garde, pas le garde lui-même.
 *
 * Démarrer un partage en direct insère une ligne dans Supabase. Hors ligne, la
 * requête part quand même, échoue après son délai, et l'utilisateur a passé
 * plusieurs secondes devant « Chargement… » avant d'apprendre que non. Le garde
 * le dit AVANT.
 *
 * Le motif affiché vient des LIBELLÉS DU SOCLE (`useLabels('guard')`), que
 * `AppRouter` alimente déjà par son `LabelsProvider` — d'où sa présence ici.
 * Le socle porte `fr` et `en`, exactement les deux langues de l'app : aucune
 * chaîne nouvelle n'a été nécessaire.
 */

// Supabase doit être « configuré » pour que la feuille montre son bouton.
vi.mock('../../supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: async () => null,
}));

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

function renderSheet() {
  return render(
    <I18nProvider>
      <LabelsProvider locale="fr">
        <LiveShareSheet open onClose={() => {}} />
      </LabelsProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  // Locale figée : sans elle, `navigator.language` de jsdom décide, et les
  // libellés attendus changent d'une machine à l'autre.
  localStorage.setItem('mm_locale', 'fr');
  // Une partie en cours : sans elle le bouton est désactivé pour une tout
  // autre raison, et le test ne prouverait rien sur le réseau.
  useMatchStore.setState({
    current: { id: 'm1', players: [], throws: [] } as never,
  });
});

afterEach(() => {
  setOnline(true);
  useMatchStore.setState({ current: null });
  useLiveStore.setState({ role: 'none', code: null, error: null });
});

describe('partage en direct hors connexion', () => {
  it('laisse démarrer le partage tant que le réseau est là', () => {
    renderSheet();
    const button = screen.getByRole('button', {
      name: 'Démarrer la diffusion',
    });
    expect(button).not.toHaveAttribute('aria-disabled');
  });

  it('bloque le démarrage ET dit pourquoi', () => {
    const startHost = vi.fn();
    useLiveStore.setState({ startHost });
    renderSheet();

    setOnline(false);

    const button = screen.getByRole('button', {
      name: 'Démarrer la diffusion',
    });
    // Bloqué sans sortir du parcours clavier : le motif reste découvrable.
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(screen.getByText('Indisponible hors ligne')).toBeInTheDocument();

    fireEvent.click(button);
    expect(startHost).not.toHaveBeenCalled();
  });
});
