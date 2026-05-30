import { lazy, Suspense, useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { HomeView } from './views/HomeView';
import { ViewSkeleton } from './components/Skeleton';
import { useI18n } from '../i18n/useI18n';
import { LEGACY_REDIRECTS, ROUTES, type RouteKey } from '../routes';

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
  return (
    <div role="status" aria-live="polite">
      <ViewSkeleton />
    </div>
  );
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
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  );
}
