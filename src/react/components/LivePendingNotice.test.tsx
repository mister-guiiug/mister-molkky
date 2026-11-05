import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { finishLiveMatch } from '../../live/liveMatch';
import { ROUTES } from '../../routes';
import type { Throw } from '../../schemas';
import { useLiveStore } from '../../store/useLiveStore';
import { Shell } from './layout/Shell';

/**
 * CE QUE CE FICHIER TIENT : la clôture d'un direct restée en attente se VOIT
 * chez l'hôte, et REPART toute seule au retour du réseau — depuis n'importe
 * quel écran, puisque l'hôte quitte souvent l'écran de partie aussitôt la
 * partie finie.
 */
vi.mock('../../live/liveMatch', () => ({
  createLiveMatch: vi.fn(),
  finishLiveMatch: vi.fn(),
  joinLiveMatch: vi.fn(),
  pushLiveThrows: vi.fn(),
  subscribeLiveMatch: vi.fn(),
  buildLiveShareUrl: vi.fn(),
}));

const finish = vi.mocked(finishLiveMatch);
const THROWS = [{ id: 't1' }] as unknown as Throw[];
const PENDING = /Fin du direct en attente/;

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

function renderShell(path: string = ROUTES.history) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <Shell>
          <p>contenu</p>
        </Shell>
      </MemoryRouter>
    </I18nProvider>
  );
}

beforeEach(() => {
  // `resetAllMocks`, pas `clearAllMocks` : un renvoi programmé par un test
  // et jamais consommé ne doit pas répondre à la place du suivant.
  vi.resetAllMocks();
  // Locale figée : sans elle, `navigator.language` de jsdom décide, et le
  // texte cherché ici serait celui de l'anglais.
  localStorage.setItem('mm_locale', 'fr');
  useLiveStore.setState({
    role: 'host',
    code: 'ABC123',
    hostToken: 'secret',
    status: 'finished',
    error: 'Failed to fetch',
    pendingFinish: { winnerId: 'p-a', throws: THROWS },
    pendingThrows: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
  act(() => useLiveStore.getState().clear());
  localStorage.removeItem('mm_locale');
});

describe('clôture du direct en attente', () => {
  it('est annoncée à l’hôte, hors de l’écran de partie', () => {
    setOnline(false);
    renderShell();

    expect(screen.getByText(PENDING)).toBeInTheDocument();
  });

  it('n’est pas annoncée sans rien qui attende', () => {
    act(() => useLiveStore.setState({ pendingFinish: null }));
    setOnline(false);
    renderShell();

    expect(screen.queryByText(PENDING)).toBeNull();
  });

  it('repart au retour du réseau, et l’annonce s’efface', async () => {
    vi.useFakeTimers();
    setOnline(false);
    finish.mockResolvedValueOnce();
    renderShell();
    expect(screen.getByText(PENDING)).toBeInTheDocument();

    setOnline(true);
    // Le répit du socle : `online` part avant que le DNS et le TLS répondent.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(finish).toHaveBeenCalledWith('ABC123', 'secret', THROWS, 'p-a');
    expect(screen.queryByText(PENDING)).toBeNull();
  });

  it('se renvoie à la main : un réseau qui ne répond pas n’émet aucun évènement', async () => {
    // Horloge figée : en ligne au montage, le socle tente une fois après son
    // répit — ce test-ci ne regarde que le bouton.
    vi.useFakeTimers();
    finish.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    finish.mockResolvedValueOnce();
    renderShell();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    });

    expect(finish).toHaveBeenCalledTimes(1);
    expect(screen.getByText(PENDING)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    });

    expect(finish).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(PENDING)).toBeNull();
  });
});
