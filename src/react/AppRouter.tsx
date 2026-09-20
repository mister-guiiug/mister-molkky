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
import { ConsentBanner } from '@mister-guiiug/dev-pwa-config/react/consent-banner';
import { usePageViews } from '@mister-guiiug/dev-pwa-config/react/use-page-views';
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

// CHAQUE IMPORT DE VUE DU MENU EST NOMMÉ, parce qu'il sert DEUX FOIS : à
// `lazy` ci-dessous, et au préchargement à l'inactivité de
// `usePrechargeLesVuesDuMenu`. Deux `import()` du même spécificateur ne
// téléchargent qu'une fois — le registre de modules dédoublonne — mais encore
// faut-il que ce soit LITTÉRALEMENT le même spécificateur, sinon le bundler
// émet deux morceaux et le préchargement ne sert plus à rien.
const chargeMatch = () => import('./views/MatchView');
const chargePlayers = () => import('./views/PlayersView');
const chargeStats = () => import('./views/StatsView');
const chargeHistory = () => import('./views/HistoryView');
const chargeSettings = () => import('./views/SettingsView');

/**
 * Les cinq vues qu'une entrée du menu peut atteindre — et elles seules.
 *
 * `JoinLiveView`, `SpectatorView` et `PracticeView` restent hors de la liste :
 * on n'y arrive pas d'un clic dans la barre basse mais par un lien de partage,
 * un QR code ou l'accueil. Les précharger ferait payer à tout le monde ce que
 * presque personne n'ouvre.
 */
const CHARGEURS_DU_MENU = [
  chargeMatch,
  chargePlayers,
  chargeStats,
  chargeHistory,
  chargeSettings,
];

const MatchView = lazy(() =>
  chargeMatch().then(m => ({ default: m.MatchView }))
);
const HistoryView = lazy(() =>
  chargeHistory().then(m => ({ default: m.HistoryView }))
);
const StatsView = lazy(() =>
  chargeStats().then(m => ({ default: m.StatsView }))
);
const PlayersView = lazy(() =>
  chargePlayers().then(m => ({ default: m.PlayersView }))
);
const SettingsView = lazy(() =>
  chargeSettings().then(m => ({ default: m.SettingsView }))
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

/** `navigator.connection` n'est pas dans les types du DOM : il reste un brouillon. */
type NavigateurEconome = Navigator & { connection?: { saveData?: boolean } };

/**
 * PRÉCHARGE LES VUES DU MENU DÈS QUE LE FIL PRINCIPAL SOUFFLE.
 *
 * LE DÉFAUT QUE CECI CORRIGE. Sans préchargement, le morceau d'une vue n'est
 * demandé qu'AU CLIC. Relevé le 20/09/2026 sur https://mister-guiiug.github.io/mister-molkky/,
 * première visite, service worker pas encore installé : le clic sur « Joueurs »
 * demande `PlayersView`, 2 039 octets — et coûte pourtant 161 ms, parce que ce
 * n'est pas du poids mais un aller-retour réseau complet, payé au pire moment.
 * Pendant ces 161 ms, l'URL indiquait déjà `/players` et l'écran affichait
 * encore l'accueil, sans rien pour le dire (voir `RouteFallback`).
 *
 * Les cinq vues du menu pèsent ensemble 23,2 Kio compressés. Téléchargées
 * pendant que le visiteur regarde l'accueil, elles ne coûtent rien de
 * perceptible — et elles n'entrent PAS dans `bundleBudget.preloadGzipKb`, qui
 * ne mesure que ce qui est `modulepreload` dans le document.
 */
function usePrechargeLesVuesDuMenu() {
  useEffect(() => {
    // `saveData` : le visiteur a demandé qu'on épargne son forfait. On ne
    // télécharge alors que ce qu'il demande vraiment — et c'est précisément
    // pour ce cas-là que le menu, lui, sait désormais dire qu'il charge.
    if ((navigator as NavigateurEconome).connection?.saveData) return;

    let annule = false;
    const precharge = () => {
      if (annule) return;
      // Un échec ici est sans conséquence : au clic, `lazy` redemandera le
      // morceau et c'est LUI qui portera l'erreur, dans son propre `Suspense`.
      for (const charge of CHARGEURS_DU_MENU) void charge().catch(() => {});
    };

    // `requestIdleCallback` manque encore à Safari avant la 17 ; le repli
    // minuté vaut mieux que rien. Le `timeout` borne l'attente sur un appareil
    // qui n'est jamais vraiment inactif.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(precharge, { timeout: 3000 });
      return () => {
        annule = true;
        window.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(precharge, 1200);
    return () => {
      annule = true;
      window.clearTimeout(id);
    };
  }, []);
}

function DocumentTitle() {
  const location = useLocation();

  /*
   * LA VUE DE PAGE VIT ICI, avec le titre du document : ce composant est déjà
   * celui qui écoute la route et ne rend rien. `initAnalytics` pose
   * `capture_pageview: false` pour que la première vue passe par ce hook comme
   * les autres : laissé à lui-même, PostHog en envoie une au chargement ET à
   * chaque changement d'historique, et l'écran d'entrée serait compté deux
   * fois.
   *
   * Ne fait rien tant que le consentement n'est pas accordé.
   */
  usePageViews(location.pathname);
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

/**
 * CE REPLI NE SE VOIT QUE SUR UN ATTERRISSAGE DIRECT, et il faut le savoir
 * avant d'essayer de l'améliorer : react-router 7 enveloppe tout changement
 * d'URL dans `startTransition` (littéralement, dans son `BrowserRouter`), et
 * React 19 garde délibérément l'écran déjà affiché plutôt que de le remplacer
 * par un repli. Sur un CLIC dans l'application, il ne paraît donc JAMAIS.
 *
 * Mesuré le 20/09/2026 sur le site publié, première visite, 188 échantillons du
 * DOM toutes les 16 ms : `aria-busy` est resté faux d'un bout à l'autre et le
 * nombre d'éléments `[role="status"]` n'a jamais quitté 1 — le `ViewSkeleton`
 * ci-dessous n'a pas été monté une seule fois, pendant que l'URL disait déjà
 * `/players` et que l'écran montrait encore l'accueil.
 *
 * C'est donc la barre de navigation qui dit qu'elle charge (voir `Shell`) ; ce
 * repli-ci ne couvre que l'arrivée de plain-pied sur une URL, où rien n'est
 * encore à l'écran.
 */
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
  usePrechargeLesVuesDuMenu();
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
      {/* Une `region`, pas une boîte modale : elle ne recouvre rien et ne
          piège pas le focus. Ne rend RIEN tant que `VITE_POSTHOG_KEY`
          n'est pas posée — sans identifiant, il n'y a rien à demander. */}
      <ConsentBanner
        posthogKey={import.meta.env.VITE_POSTHOG_KEY}
        loader={() => import('posthog-js/dist/module.slim.js')}
      />
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
