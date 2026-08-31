import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../../../i18n';
import { ROUTES } from '../../../routes';
import { ConnectionBanner } from '../ConnectionBanner';
import { useLiveStore } from '../../../store/useLiveStore';
import {
  ChartIcon,
  HistoryIcon,
  HomeIcon,
  PlayIcon,
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
  const isMatch = location.pathname === ROUTES.match;
  const liveRole = useLiveStore(s => s.role);

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
          {NAV.map(({ to, labelKey, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === ROUTES.home}
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
                <Icon size={20} />
                <span className="leading-none">{t(labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
