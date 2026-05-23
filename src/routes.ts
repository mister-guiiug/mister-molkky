export const ROUTES = {
  home: '/',
  match: '/partie',
  history: '/historique',
  stats: '/statistiques',
  players: '/joueurs',
  settings: '/parametres',
} as const;

export type RouteKey = keyof typeof ROUTES;

export const LEGACY_REDIRECTS: Record<string, string> = {
  '/match': ROUTES.match,
  '/history': ROUTES.history,
  '/stats': ROUTES.stats,
  '/players': ROUTES.players,
  '/settings': ROUTES.settings,
};

export const ROUTE_TITLES: Record<RouteKey, string> = {
  home: 'Mister Mölkky',
  match: 'Partie en cours',
  history: 'Historique',
  stats: 'Statistiques',
  players: 'Joueurs',
  settings: 'Paramètres',
};
