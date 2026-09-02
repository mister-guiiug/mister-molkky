export const ROUTES = {
  home: '/',
  match: '/match',
  history: '/history',
  stats: '/stats',
  players: '/players',
  settings: '/settings',
  joinLive: '/join',
  spectator: '/live',
  practice: '/practice',
} as const;

export type RouteKey =
  | 'home'
  | 'match'
  | 'history'
  | 'stats'
  | 'players'
  | 'settings';

export const LEGACY_REDIRECTS: Record<string, string> = {
  '/partie': ROUTES.match,
  '/historique': ROUTES.history,
  '/statistiques': ROUTES.stats,
  '/joueurs': ROUTES.players,
  '/parametres': ROUTES.settings,
  '/rejoindre': ROUTES.joinLive,
};

/**
 * Ancien chemin de la vue spectateur (« /direct », l'ère des routes en
 * français) : encodé dans les QR imprimés/partagés avant le renommage vers
 * `/live` — et même après, tant que LiveShareSheet a gardé un littéral
 * `direct/` codé en dur. Paramétré (`/direct/:code`), il ne rentre pas dans
 * LEGACY_REDIRECTS, qui ne mappe que des chemins statiques : AppRouter le
 * redirige explicitement, et l'extraction de scan l'accepte encore.
 */
export const LEGACY_SPECTATOR_PATH = '/direct';
