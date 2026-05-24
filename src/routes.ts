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

export const ROUTE_TITLES: Record<RouteKey, string> = {
  home: 'Mister Mölkky',
  match: 'Match in progress',
  history: 'History',
  stats: 'Statistics',
  players: 'Players',
  settings: 'Settings',
};
