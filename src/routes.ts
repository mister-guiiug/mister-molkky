export const ROUTES = {
  home: '/',
  match: '/partie',
  history: '/historique',
  stats: '/statistiques',
  players: '/joueurs',
  settings: '/parametres',
  joinLive: '/rejoindre',
  spectator: '/direct',
  practice: '/entrainement',
} as const;

export type RouteKey =
  | 'home'
  | 'match'
  | 'history'
  | 'stats'
  | 'players'
  | 'settings';

export const LEGACY_REDIRECTS: Record<string, string> = {
  '/match': ROUTES.match,
  '/history': ROUTES.history,
  '/stats': ROUTES.stats,
  '/players': ROUTES.players,
  '/settings': ROUTES.settings,
  '/join': ROUTES.joinLive,
};

export const ROUTE_TITLES: Record<RouteKey, string> = {
  home: 'Mister Mölkky',
  match: 'Partie en cours',
  history: 'Historique',
  stats: 'Statistiques',
  players: 'Joueurs',
  settings: 'Paramètres',
};
