import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { I18nProvider, LOCALE_STORAGE_KEY } from '../i18n';
import { useSettingsStore } from '../store/useSettingsStore';
import { App } from './AppRouter';

/**
 * CE QUE CE TEST TIENT : après l'inactivité, les cinq vues du menu sont
 * demandées — et les trois autres, non. Vérifié à la main dans la PR #87
 * (« sans aucun clic, après l'inactivité, les cinq vues du menu sont
 * chargées ; les trois autres, non »), verrouillé ici.
 *
 * La mécanique du QUAND — `requestIdleCallback`, son repli, `saveData`, la
 * 2G, l'exécution unique — appartient au socle et y est éprouvée
 * (`test/prefetch.test.mjs`, `test/react-use-prefetch.test.mjs`). Ici, on ne
 * vérifie que ce que l'app y branche : QUOI, et sous quelle condition.
 *
 * Chaque vue est remplacée par une fabrique qui NOTE son propre import :
 * c'est le seul moyen d'observer un `import()` sans regarder le réseau.
 */
const importe = vi.hoisted(() => ({
  match: vi.fn(),
  players: vi.fn(),
  stats: vi.fn(),
  history: vi.fn(),
  settings: vi.fn(),
  joinLive: vi.fn(),
  spectator: vi.fn(),
  practice: vi.fn(),
}));

vi.mock('./views/MatchView', () => {
  importe.match();
  return { MatchView: () => null };
});
vi.mock('./views/PlayersView', () => {
  importe.players();
  return { PlayersView: () => null };
});
vi.mock('./views/StatsView', () => {
  importe.stats();
  return { StatsView: () => null };
});
vi.mock('./views/HistoryView', () => {
  importe.history();
  return { HistoryView: () => null };
});
vi.mock('./views/SettingsView', () => {
  importe.settings();
  return { SettingsView: () => null };
});
vi.mock('./views/JoinLiveView', () => {
  importe.joinLive();
  return { JoinLiveView: () => null };
});
vi.mock('./views/SpectatorView', () => {
  importe.spectator();
  return { SpectatorView: () => null };
});
vi.mock('./views/PracticeView', () => {
  importe.practice();
  return { PracticeView: () => null };
});

const VUES_DU_MENU = [
  importe.match,
  importe.players,
  importe.stats,
  importe.history,
  importe.settings,
];
const VUES_HORS_MENU = [importe.joinLive, importe.spectator, importe.practice];

/**
 * Le navigateur est au repos tout de suite : le rappel part sans attendre.
 * Rend l'espion, pour prouver que le socle a bien PLANIFIÉ quelque chose.
 */
function navigateurAuRepos() {
  const planifie = vi.fn((rappel: () => void) => {
    rappel();
    return 1;
  });
  vi.stubGlobal('requestIdleCallback', planifie);
  vi.stubGlobal('cancelIdleCallback', () => undefined);
  return planifie;
}

function monterLApp() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}

/** Laisse aux `import()` le temps d'aboutir — ou de ne pas partir. */
async function laisserPasserLesImports() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });
}

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
  useSettingsStore.getState().reset();
  useSettingsStore.getState().markWelcomeSeen();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (navigator as { connection?: unknown }).connection;
});

describe('le préchargement des vues du menu', () => {
  // CE CAS PASSE EN PREMIER, et ce n'est pas un hasard : le socle ne lance un
  // chargeur qu'une fois par identité. Une fois les cinq vues parties (cas
  // suivant), plus rien ne partirait ici et le test ne prouverait plus rien.
  it("n'emporte rien quand le visiteur épargne son forfait", async () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true },
      configurable: true,
    });
    const planifie = navigateurAuRepos();

    monterLApp();
    await laisserPasserLesImports();

    // Le rappel a bien été planifié ET exécuté : c'est au moment de partir
    // que le socle regarde `saveData`, et qu'il renonce.
    expect(planifie).toHaveBeenCalledTimes(1);
    for (const vue of [...VUES_DU_MENU, ...VUES_HORS_MENU]) {
      expect(vue).not.toHaveBeenCalled();
    }
  });

  it("demande les cinq vues du menu, et elles seules, dès l'inactivité", async () => {
    navigateurAuRepos();

    monterLApp();
    await laisserPasserLesImports();

    for (const vue of VUES_DU_MENU) expect(vue).toHaveBeenCalledTimes(1);
    // On n'y arrive pas d'un clic dans la barre basse : les précharger ferait
    // payer à tout le monde ce que presque personne n'ouvre.
    for (const vue of VUES_HORS_MENU) expect(vue).not.toHaveBeenCalled();
  });
});
