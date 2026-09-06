import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { LabelsProvider } from '@mister-guiiug/dev-pwa-config/react/labels';
import { IconsProvider } from '@mister-guiiug/dev-pwa-config/react/icons-context';
import { ToastProvider } from '@mister-guiiug/dev-pwa-config/react/toast';
import { Shell } from './components/layout/Shell';
import { HomeView } from './views/HomeView';
import { ViewSkeleton } from './components/Skeleton';
import { CloseIcon } from './components/icons';
import { useI18n } from '../i18n';
import {
  LEGACY_REDIRECTS,
  LEGACY_SPECTATOR_PATH,
  ROUTES,
  type RouteKey,
} from '../routes';

/*
 * Icônes injectées dans les composants du socle (Sheet, Toast…) : la croix
 * de fermeture doit être la même lucide que partout ailleurs dans l'app,
 * pas le SVG de repli du paquet.
 */
const SOCLE_ICONS = { close: CloseIcon };

const MatchView = lazy(() =>
  import('./views/MatchView').then(m => ({ default: m.MatchView }))
);
const HistoryView = lazy(() =>
  import('./views/HistoryView').then(m => ({ default: m.HistoryView }))
);
const StatsView = lazy(() =>
  import('./views/StatsView').then(m => ({ default: m.StatsView }))
);
const PlayersView = lazy(() =>
  import('./views/PlayersView').then(m => ({ default: m.PlayersView }))
);
const SettingsView = lazy(() =>
  import('./views/SettingsView').then(m => ({ default: m.SettingsView }))
);
const JoinLiveView = lazy(() =>
  import('./views/JoinLiveView').then(m => ({ default: m.JoinLiveView }))
);
const SpectatorView = lazy(() =>
  import('./views/SpectatorView').then(m => ({ default: m.SpectatorView }))
);
const PracticeView = lazy(() =>
  import('./views/PracticeView').then(m => ({ default: m.PracticeView }))
);

function DocumentTitle() {
  const location = useLocation();
  const { t, locale } = useI18n();

  useEffect(() => {
    const pathToKey: Record<string, RouteKey> = {
      [ROUTES.home]: 'home',
      [ROUTES.match]: 'match',
      [ROUTES.history]: 'history',
      [ROUTES.stats]: 'stats',
      [ROUTES.players]: 'players',
      [ROUTES.settings]: 'settings',
    };
    const key: RouteKey = pathToKey[location.pathname] ?? 'home';
    document.title = t(`documentTitle.${key}`);
  }, [location.pathname, t, locale]);

  return null;
}

function RouteFallback() {
  // Le rôle `status` + aria-busy est porté par le SkeletonGroup du socle,
  // à l'intérieur de ViewSkeleton — plus besoin d'un conteneur annoncé ici.
  return <ViewSkeleton />;
}

// Les QR de partage émis avant le correctif de l'URL portent l'ancien
// chemin spectateur `/direct/CODE` (voir LEGACY_SPECTATOR_PATH) : scannés
// par l'appareil photo natif, ils arrivent ici — hors de portée de
// LEGACY_REDIRECTS, statique — et doivent conserver leur code.
function LegacySpectatorRedirect() {
  const { code } = useParams<{ code: string }>();
  return <Navigate to={`${ROUTES.spectator}/${code ?? ''}`} replace />;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <Shell>
      <DocumentTitle />
      <Suspense fallback={<RouteFallback />}>
        {/*
          Keying the wrapper on the pathname remounts it on every
          navigation, which replays the `mm-view-enter` CSS animation for
          a gentle cross-route fade/lift. The keyframes are disabled under
          prefers-reduced-motion (see styles.css), so this is a no-op for
          users who opt out of motion.
        */}
        <div key={location.pathname} className="mm-view-enter">
          <Routes location={location}>
            <Route path={ROUTES.home} element={<HomeView />} />
            <Route path={ROUTES.match} element={<MatchView />} />
            <Route path={ROUTES.history} element={<HistoryView />} />
            <Route path={ROUTES.stats} element={<StatsView />} />
            <Route path={ROUTES.players} element={<PlayersView />} />
            <Route path={ROUTES.settings} element={<SettingsView />} />
            <Route path={ROUTES.joinLive} element={<JoinLiveView />} />
            <Route
              path={`${ROUTES.spectator}/:code`}
              element={<SpectatorView />}
            />
            <Route
              path={`${LEGACY_SPECTATOR_PATH}/:code`}
              element={<LegacySpectatorRedirect />}
            />
            <Route path={ROUTES.practice} element={<PracticeView />} />
            {Object.entries(LEGACY_REDIRECTS).map(([legacy, target]) => (
              <Route
                key={legacy}
                path={legacy}
                element={<Navigate to={target} replace />}
              />
            ))}
            <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
          </Routes>
        </div>
      </Suspense>
    </Shell>
  );
}

export function App() {
  const { locale } = useI18n();
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
  return (
    // Pont i18n → socle : les libellés internes des composants partagés
    // (Annuler / Supprimer / Fermer…) suivent la langue de l'app au lieu de
    // rester sur le français par défaut du paquet.
    <LabelsProvider locale={locale}>
      <IconsProvider icons={SOCLE_ICONS}>
        {/*
          La pile de notifications du socle — montée ICI, au-dessus du routeur,
          parce qu'une notification doit SURVIVRE au changement d'écran : celle
          qui propose d'annuler une suppression perdrait tout son sens si
          quitter l'historique l'emportait avec lui.

          `duration: 8000` et non les 5 000 ms du socle : c'est le délai que
          `docs/cloud-sync.md` annonce, et huit secondes sont ce qu'il faut
          pour lire « Partie supprimée », comprendre que ce n'était pas la
          bonne, et viser un bouton sur un téléphone. Le compte à rebours est
          suspendu tant que le pointeur ou le focus est sur la pile (le socle
          s'en charge, WCAG 2.2.1).
        */}
        <ToastProvider duration={8000}>
          <BrowserRouter basename={basename}>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </IconsProvider>
    </LabelsProvider>
  );
}
