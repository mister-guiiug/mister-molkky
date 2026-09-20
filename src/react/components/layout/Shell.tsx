import {
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../../../i18n';
import { ROUTES } from '../../../routes';
import { ConnectionBanner } from '../ConnectionBanner';
import { useLiveStore } from '../../../store/useLiveStore';
import {
  ChartIcon,
  HistoryIcon,
  HomeIcon,
  PlayIcon,
  RefreshIcon,
  SettingsIcon,
  UsersIcon,
} from '../icons';

interface ShellProps {
  children: ReactNode;
}

interface NavItem {
  to: string;
  labelKey:
    | 'nav.home'
    | 'nav.match'
    | 'nav.history'
    | 'nav.stats'
    | 'nav.players'
    | 'nav.settings';
  Icon: typeof HomeIcon;
}

const NAV: NavItem[] = [
  { to: ROUTES.home, labelKey: 'nav.home', Icon: HomeIcon },
  { to: ROUTES.match, labelKey: 'nav.match', Icon: PlayIcon },
  { to: ROUTES.players, labelKey: 'nav.players', Icon: UsersIcon },
  { to: ROUTES.stats, labelKey: 'nav.stats', Icon: ChartIcon },
  { to: ROUTES.history, labelKey: 'nav.history', Icon: HistoryIcon },
  { to: ROUTES.settings, labelKey: 'nav.settings', Icon: SettingsIcon },
];

export function Shell({ children }: ShellProps) {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [enCours, demarreLaTransition] = useTransition();
  const [ciblePendante, setCiblePendante] = useState<string | null>(null);
  const isMatch = location.pathname === ROUTES.match;
  const liveRole = useLiveStore(s => s.role);

  /**
   * LA TRANSITION EST LA NÔTRE, et c'est tout l'intérêt.
   *
   * react-router 7 en ouvre déjà une de son côté — `startTransition(() =>
   * setStateImpl(newState))` dans son `BrowserRouter` — mais ne l'expose nulle
   * part hors d'un routeur de données. Conséquence mesurée le 20/09/2026 sur le
   * site publié : le repli de `Suspense` ne paraît JAMAIS sur un clic, puisque
   * React 19 garde l'écran déjà affiché pendant une transition. Le clic sur une
   * entrée du menu était donc muet pendant 161 ms à la première visite.
   *
   * En pilotant `navigate` depuis ici, `enCours` reste vrai tant que le morceau
   * de la vue n'est pas arrivé : c'est la seule information qui manquait pour
   * répondre au visiteur.
   *
   * IL N'Y A RIEN À REFERMER ICI. Sur badminton (PR #80), la troisième pièce du
   * correctif consistait à ne plus fermer le tiroir au clic — il emportait le
   * seul endroit qui pouvait dire « je charge ». Mölkky n'a pas de tiroir : sa
   * barre basse est fixe et survit à la navigation, donc la pastille qui tourne
   * reste sous les yeux jusqu'à l'arrivée de la vue. La règle tient quand même,
   * et un test la verrouille : pendant le chargement, le menu est TOUJOURS là.
   */
  const versLaVue = (e: MouseEvent<HTMLAnchorElement>, to: string) => {
    // On laisse le navigateur faire son travail quand le visiteur le lui
    // demande : nouvel onglet, nouvelle fenêtre, enregistrement de la cible.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    setCiblePendante(to);
    demarreLaTransition(() => navigate(to));
  };

  // SUR L'ÉCRAN DE PARTIE, LE SILENCE EST LA BONNE RÉPONSE — sauf une fois.
  // Le score d'une partie de Mölkky est intégralement local (`useMatchStore`,
  // zustand + localStorage) : sans réseau, il ne se passe rigoureusement rien.
  // Interrompre quelqu'un au milieu d'une manche pour lui signaler une panne
  // qui ne le concerne pas, c'est du bruit. D'où le `!isMatch` d'origine, qui
  // était juste — mais avait un angle mort : quand la partie est DIFFUSÉE en
  // direct, chaque lancer est poussé vers Supabase et l'échec est avalé
  // (`useLiveStore`). Les spectateurs se figent sans que l'hôte le sache.
  const showConnection = !isMatch || liveRole === 'host';

  return (
    <div className="flex min-h-dvh flex-col">
      {showConnection && <ConnectionBanner />}
      <main className="flex-1 pb-24 sm:pb-28">{children}</main>
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md"
        style={{
          background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
          borderColor: 'var(--border)',
        }}
        aria-label="Navigation principale"
      >
        <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2 py-1.5">
          {NAV.map(({ to, labelKey, Icon }) => {
            const charge = enCours && ciblePendante === to;
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  end={to === ROUTES.home}
                  onClick={e => versLaVue(e, to)}
                  aria-busy={charge || undefined}
                  className={({ isActive }) =>
                    `touch-target flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[0.65rem] font-semibold transition ${
                      isActive ? 'opacity-100' : 'opacity-55'
                    }`
                  }
                  style={({ isActive }) => ({
                    color: isActive ? 'var(--primary)' : 'var(--text)',
                    background: isActive
                      ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
                      : 'transparent',
                  })}
                >
                  {/* LA PASTILLE DE L'ENTRÉE CLIQUÉE TOURNE pendant que son
                    morceau arrive. C'est le seul retour visible : le repli de
                    `Suspense` ne paraîtra pas, React 19 gardant l'écran courant
                    le temps de la transition (voir `RouteFallback`). */}
                  {charge ? (
                    <RefreshIcon size={20} className="animate-spin" />
                  ) : (
                    <Icon size={20} />
                  )}
                  <span className="leading-none">{t(labelKey)}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
        {/* HORS DES LIENS, pour ne pas changer leur nom accessible en cours de
            route : un lecteur d'écran annoncerait « Joueurs, chargement… » puis
            « Joueurs », sur le lien qui a le focus. */}
        <span className="sr-only" role="status" aria-live="polite">
          {enCours ? t('nav.loading') : ''}
        </span>
      </nav>
    </div>
  );
}
