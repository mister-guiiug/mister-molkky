import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { Shell } from './layout/Shell';
import { ROUTES } from '../../routes';
import { useLiveStore } from '../../store/useLiveStore';

/**
 * CE QUE CES TESTS TIENNENT.
 *
 * 1. LA TEMPORISATION. Mölkky se joue DEHORS, en bord de réseau : c'est l'app
 *    de la famille qui verra le plus de micro-coupures. La pastille d'avant
 *    apparaissait au premier `offline` venu et clignotait. Le bandeau du socle
 *    attend 1,5 s hors ligne CONTINU — et ce test échoue si quelqu'un ramène
 *    ce délai à zéro « pour que le test passe plus vite ».
 *
 * 2. LE SILENCE PENDANT UNE PARTIE. Le score d'une partie est intégralement
 *    local. Signaler une panne réseau à quelqu'un qui compte des quilles est du
 *    bruit pur — sauf s'il DIFFUSE la partie, car alors les spectateurs se
 *    figent. Ces deux cas sont la raison d'être de cette PR ; ils ne se
 *    devinent pas en lisant le composant.
 */

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

function renderShell(path: string) {
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

/** Le bandeau du socle, distinct de tout autre `role="status"` de l'app. */
const banner = () => document.querySelector('[data-dwc="connection-banner"]');

afterEach(() => {
  vi.useRealTimers();
  setOnline(true);
  act(() => useLiveStore.setState({ role: 'none' }));
});

describe('bandeau hors connexion', () => {
  it('reste muet en ligne', () => {
    renderShell(ROUTES.home);
    expect(banner()).toBeNull();
  });

  it("attend 1,5 s hors ligne continu avant de s'afficher", () => {
    vi.useFakeTimers();
    renderShell(ROUTES.home);

    setOnline(false);
    act(() => void vi.advanceTimersByTime(1499));
    expect(banner()).toBeNull(); // la micro-coupure ne fait pas clignoter

    act(() => void vi.advanceTimersByTime(1));
    expect(banner()).toBeInTheDocument();
    // Le texte est celui de l'APP (« vos données sont sauvegardées
    // localement »), pas le défaut du socle (« Hors ligne — reconnexion… ») :
    // ici, la nuance est tout le message. La locale de jsdom n'est pas
    // garantie, d'où les deux formulations.
    expect(screen.getByRole('status')).toHaveTextContent(
      /sauvegardées localement|saved locally/
    );
  });

  it('disparaît immédiatement au retour du réseau', () => {
    vi.useFakeTimers();
    renderShell(ROUTES.home);
    setOnline(false);
    act(() => void vi.advanceTimersByTime(1500));
    expect(banner()).toBeInTheDocument();

    setOnline(true);
    expect(banner()).toBeNull();
  });

  it("se tait pendant une partie : le score ne dépend d'aucun réseau", () => {
    vi.useFakeTimers();
    renderShell(ROUTES.match);
    setOnline(false);
    act(() => void vi.advanceTimersByTime(3000));
    expect(banner()).toBeNull();
  });

  it('parle quand même si la partie est diffusée en direct', () => {
    vi.useFakeTimers();
    act(() => useLiveStore.setState({ role: 'host' }));
    renderShell(ROUTES.match);
    setOnline(false);
    act(() => void vi.advanceTimersByTime(1500));
    // Les spectateurs sont figés : l'hôte doit le savoir.
    expect(banner()).toBeInTheDocument();
  });
});
