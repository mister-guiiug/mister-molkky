export type Locale = 'fr' | 'en';

export interface Messages {
  appName: string;
  tagline: string;
  nav: {
    home: string;
    match: string;
    history: string;
    stats: string;
    players: string;
    settings: string;
  };
  documentTitle: {
    home: string;
    match: string;
    history: string;
    stats: string;
    players: string;
    settings: string;
  };
  common: {
    start: string;
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    add: string;
    next: string;
    back: string;
    close: string;
    yes: string;
    no: string;
    loading: string;
    empty: string;
    error: string;
    or: string;
    points: string;
    pointsShort: string;
  };
  home: {
    title: string;
    newMatch: string;
    resumeMatch: string;
    quickStart: string;
    aboutGame: string;
    aboutGameText: string;
    seeRules: string;
  };
  setup: {
    title: string;
    step1: string;
    step2: string;
    step3: string;
    pickPlayers: string;
    pickPlayersHint: string;
    addPlayerHere: string;
    addPlayerName: string;
    shuffleOrder: string;
    targetScore: string;
    overshootPenalty: string;
    maxMisses: string;
    teamMode: string;
    teamSolo: string;
    teamDuo: string;
    teamTrio: string;
    recap: string;
    startMatch: string;
    needMinPlayers: string;
    needMinPlayersHint: string;
  };
  match: {
    turnOf: string;
    score: string;
    miss: string;
    misses: string;
    validateThrow: string;
    selectFallenPins: string;
    knockedDown: string;
    knockedDownCount: string;
    noPinsKnockedDown: string;
    undo: string;
    abandon: string;
    abandonConfirm: string;
    restart: string;
    elimination: string;
    eliminationMessage: string;
    overshootMessage: string;
    victory: string;
    victoryMessage: string;
    seeRanking: string;
    playAgain: string;
    backToHome: string;
    eliminated: string;
    winner: string;
    tap: string;
    longPressHint: string;
    chrono: string;
    standUp: string;
    pin: string;
    pinDown: string;
    pinStanding: string;
  };
  history: {
    title: string;
    empty: string;
    filter: string;
    search: string;
    searchPlaceholder: string;
    deleteAll: string;
    deleteAllConfirm: string;
    deleteOne: string;
    durationLabel: string;
    throwsLabel: string;
    won: string;
    against: string;
  };
  stats: {
    title: string;
    empty: string;
    pickPlayer: string;
    matchesPlayed: string;
    matchesWon: string;
    winRate: string;
    podiums: string;
    accuracy: string;
    avgScore: string;
    avgScorePerThrow: string;
    bestStreak: string;
    exactFifties: string;
    overshoots: string;
    topPin: string;
    none: string;
    pinFrequency: string;
  };
  players: {
    title: string;
    addPlayer: string;
    name: string;
    color: string;
    avatar: string;
    pickAvatar: string;
    clearAvatar: string;
    removeConfirm: string;
    empty: string;
    emptyHint: string;
  };
  settings: {
    title: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    language: string;
    sounds: string;
    vibrations: string;
    wakeLock: string;
    wakeLockHint: string;
    export: string;
    import: string;
    importFailed: string;
    importApplied: string;
    eraseAll: string;
    eraseAllConfirm: string;
    about: string;
    aboutText: string;
    version: string;
  };
  install: {
    text: string;
    button: string;
    dismiss: string;
  };
  offline: {
    title: string;
  };
  welcome: {
    title: string;
    p1: string;
    p2: string;
    p3: string;
    p4: string;
    cta: string;
    skip: string;
  };
  toast: {
    undo: string;
    saved: string;
    copied: string;
    shared: string;
    failed: string;
  };
  a11y: {
    pinAt: string;
    score: string;
    closeDialog: string;
    fullscreen: string;
    exitFullscreen: string;
  };
}

const fr: Messages = {
  appName: 'Mister Mölkky',
  tagline: 'Comptez vos parties de Mölkky.',
  nav: {
    home: 'Accueil',
    match: 'Partie',
    history: 'Historique',
    stats: 'Statistiques',
    players: 'Joueurs',
    settings: 'Paramètres',
  },
  documentTitle: {
    home: 'Mister Mölkky',
    match: 'Partie en cours — Mister Mölkky',
    history: 'Historique — Mister Mölkky',
    stats: 'Statistiques — Mister Mölkky',
    players: 'Joueurs — Mister Mölkky',
    settings: 'Paramètres — Mister Mölkky',
  },
  common: {
    start: 'Démarrer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    save: 'Enregistrer',
    delete: 'Supprimer',
    edit: 'Modifier',
    add: 'Ajouter',
    next: 'Suivant',
    back: 'Retour',
    close: 'Fermer',
    yes: 'Oui',
    no: 'Non',
    loading: 'Chargement…',
    empty: 'Rien à afficher',
    error: 'Une erreur est survenue',
    or: 'ou',
    points: 'points',
    pointsShort: 'pts',
  },
  home: {
    title: 'Bienvenue dans Mister Mölkky',
    newMatch: 'Nouvelle partie',
    resumeMatch: 'Reprendre la partie',
    quickStart: 'Commencer rapidement',
    aboutGame: 'Le Mölkky en bref',
    aboutGameText:
      'Jeu de quilles finlandais : visez la « mölkky » (le bâton) pour faire tomber des quilles numérotées. Premier à 50 pile gagne.',
    seeRules: 'Voir les règles',
  },
  setup: {
    title: 'Nouvelle partie',
    step1: 'Joueurs',
    step2: 'Règles',
    step3: 'Récap',
    pickPlayers: 'Choisissez les joueurs',
    pickPlayersHint: 'Au moins 2, jusqu’à 16. Glissez pour réorganiser.',
    addPlayerHere: 'Ajouter un joueur',
    addPlayerName: 'Prénom du joueur',
    shuffleOrder: 'Mélanger l’ordre de passage',
    targetScore: 'Score à atteindre',
    overshootPenalty: 'Score en cas de dépassement',
    maxMisses: 'Ratés consécutifs avant élimination',
    teamMode: 'Format',
    teamSolo: 'Individuel',
    teamDuo: 'Duo',
    teamTrio: 'Trio',
    recap: 'Récapitulatif',
    startMatch: 'Démarrer la partie',
    needMinPlayers: 'Sélectionnez au moins 2 joueurs',
    needMinPlayersHint:
      'Créez d’abord des joueurs depuis l’onglet Joueurs si vous n’en avez pas.',
  },
  match: {
    turnOf: 'Au tour de',
    score: 'Score',
    miss: 'Raté',
    misses: 'ratés',
    validateThrow: 'Valider le tir',
    selectFallenPins: 'Touchez les quilles tombées',
    knockedDown: 'tombée',
    knockedDownCount: '{n} quilles tombées',
    noPinsKnockedDown: 'Aucune quille tombée',
    undo: 'Annuler',
    abandon: 'Abandonner',
    abandonConfirm: 'Abandonner la partie en cours ?',
    restart: 'Recommencer',
    elimination: 'Éliminé',
    eliminationMessage: '{name} est éliminé après 3 ratés.',
    overshootMessage: '{name} dépasse 50 → score retombe à 25.',
    victory: 'Victoire !',
    victoryMessage: '{name} gagne la partie',
    seeRanking: 'Voir le classement',
    playAgain: 'Rejouer',
    backToHome: 'Retour à l’accueil',
    eliminated: 'Éliminé',
    winner: 'Vainqueur',
    tap: 'Touchez',
    longPressHint: 'Appui long : tout sélectionner',
    chrono: 'Chrono',
    standUp: 'Redresser',
    pin: 'Quille',
    pinDown: 'tombée',
    pinStanding: 'debout',
  },
  history: {
    title: 'Historique des parties',
    empty: 'Aucune partie terminée pour le moment.',
    filter: 'Filtrer',
    search: 'Rechercher',
    searchPlaceholder: 'Nom de joueur…',
    deleteAll: 'Tout effacer',
    deleteAllConfirm: 'Effacer tout l’historique ?',
    deleteOne: 'Supprimer cette partie',
    durationLabel: 'Durée',
    throwsLabel: 'Lancers',
    won: 'gagne',
    against: 'contre',
  },
  stats: {
    title: 'Statistiques',
    empty: 'Pas encore de données — jouez quelques parties !',
    pickPlayer: 'Choisir un joueur',
    matchesPlayed: 'Parties jouées',
    matchesWon: 'Victoires',
    winRate: 'Taux de victoire',
    podiums: 'Podiums',
    accuracy: 'Précision',
    avgScore: 'Score moyen',
    avgScorePerThrow: 'Score moyen / lancer',
    bestStreak: 'Meilleure série',
    exactFifties: 'Pile 50',
    overshoots: 'Dépassements',
    topPin: 'Quille préférée',
    none: '—',
    pinFrequency: 'Quilles touchées',
  },
  players: {
    title: 'Joueurs',
    addPlayer: 'Ajouter un joueur',
    name: 'Nom',
    color: 'Couleur',
    avatar: 'Photo',
    pickAvatar: 'Choisir une photo',
    clearAvatar: 'Retirer la photo',
    removeConfirm: 'Retirer {name} du roster ?',
    empty: 'Aucun joueur enregistré',
    emptyHint: 'Ajoutez les habitués pour les retrouver rapidement.',
  },
  settings: {
    title: 'Paramètres',
    theme: 'Thème',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Système',
    language: 'Langue',
    sounds: 'Sons',
    vibrations: 'Vibrations',
    wakeLock: 'Garder l’écran allumé en partie',
    wakeLockHint:
      'L’écran reste actif tant qu’une partie est en cours (compatible Android / iOS Safari).',
    export: 'Exporter mes données (JSON)',
    import: 'Importer un fichier',
    importFailed: 'Import impossible',
    importApplied: '{n} match(es) importé(s)',
    eraseAll: 'Effacer toutes les données',
    eraseAllConfirm:
      'Supprimer définitivement tous les joueurs, parties et réglages ?',
    about: 'À propos',
    aboutText:
      'Mister Mölkky — application offline, vos données restent sur votre appareil.',
    version: 'Version',
  },
  install: {
    text: 'Installer l’application sur cet appareil ?',
    button: 'Installer',
    dismiss: 'Plus tard',
  },
  offline: {
    title: 'Hors-ligne — vos données sont sauvegardées localement.',
  },
  welcome: {
    title: 'Bienvenue dans Mister Mölkky',
    p1: '12 quilles, 2 à 16 joueurs, premier à 50 pile gagne.',
    p2: 'Touchez les quilles tombées après chaque lancer.',
    p3: 'Dépassement de 50 → score retombe à 25.',
    p4: '3 ratés consécutifs → vous êtes éliminé.',
    cta: 'C’est parti !',
    skip: 'Passer',
  },
  toast: {
    undo: 'Action annulée',
    saved: 'Enregistré',
    copied: 'Copié dans le presse-papiers',
    shared: 'Partagé',
    failed: 'Action impossible',
  },
  a11y: {
    pinAt: 'Quille numéro {n}, {state}',
    score: 'Score : {n} points',
    closeDialog: 'Fermer la fenêtre',
    fullscreen: 'Passer en plein écran',
    exitFullscreen: 'Quitter le plein écran',
  },
};

const en: Messages = {
  appName: 'Mister Mölkky',
  tagline: 'Track your Mölkky games.',
  nav: {
    home: 'Home',
    match: 'Match',
    history: 'History',
    stats: 'Stats',
    players: 'Players',
    settings: 'Settings',
  },
  documentTitle: {
    home: 'Mister Mölkky',
    match: 'Live match — Mister Mölkky',
    history: 'History — Mister Mölkky',
    stats: 'Stats — Mister Mölkky',
    players: 'Players — Mister Mölkky',
    settings: 'Settings — Mister Mölkky',
  },
  common: {
    start: 'Start',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    next: 'Next',
    back: 'Back',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    loading: 'Loading…',
    empty: 'Nothing here yet',
    error: 'An error occurred',
    or: 'or',
    points: 'points',
    pointsShort: 'pts',
  },
  home: {
    title: 'Welcome to Mister Mölkky',
    newMatch: 'New match',
    resumeMatch: 'Resume match',
    quickStart: 'Quick start',
    aboutGame: 'About Mölkky',
    aboutGameText:
      'Finnish skittles game: throw the "mölkky" stick to knock down numbered pins. First to exactly 50 wins.',
    seeRules: 'See the rules',
  },
  setup: {
    title: 'New match',
    step1: 'Players',
    step2: 'Rules',
    step3: 'Recap',
    pickPlayers: 'Pick players',
    pickPlayersHint: 'At least 2, up to 16. Drag to reorder.',
    addPlayerHere: 'Add a player',
    addPlayerName: 'Player name',
    shuffleOrder: 'Shuffle turn order',
    targetScore: 'Target score',
    overshootPenalty: 'Score after overshoot',
    maxMisses: 'Consecutive misses before elimination',
    teamMode: 'Format',
    teamSolo: 'Solo',
    teamDuo: 'Pairs',
    teamTrio: 'Trios',
    recap: 'Recap',
    startMatch: 'Start match',
    needMinPlayers: 'Pick at least 2 players',
    needMinPlayersHint:
      'Create players from the Players tab first if you don’t have any.',
  },
  match: {
    turnOf: 'Turn of',
    score: 'Score',
    miss: 'Miss',
    misses: 'misses',
    validateThrow: 'Validate throw',
    selectFallenPins: 'Tap fallen pins',
    knockedDown: 'down',
    knockedDownCount: '{n} pins down',
    noPinsKnockedDown: 'No pins down',
    undo: 'Undo',
    abandon: 'Abandon',
    abandonConfirm: 'Abandon the current match?',
    restart: 'Restart',
    elimination: 'Eliminated',
    eliminationMessage: '{name} is eliminated after 3 misses.',
    overshootMessage: '{name} went over 50 → score back to 25.',
    victory: 'Victory!',
    victoryMessage: '{name} wins',
    seeRanking: 'See ranking',
    playAgain: 'Play again',
    backToHome: 'Back to home',
    eliminated: 'Eliminated',
    winner: 'Winner',
    tap: 'Tap',
    longPressHint: 'Long press: select all',
    chrono: 'Timer',
    standUp: 'Stand up',
    pin: 'Pin',
    pinDown: 'down',
    pinStanding: 'standing',
  },
  history: {
    title: 'Match history',
    empty: 'No finished matches yet.',
    filter: 'Filter',
    search: 'Search',
    searchPlaceholder: 'Player name…',
    deleteAll: 'Delete all',
    deleteAllConfirm: 'Erase all history?',
    deleteOne: 'Delete this match',
    durationLabel: 'Duration',
    throwsLabel: 'Throws',
    won: 'wins',
    against: 'against',
  },
  stats: {
    title: 'Stats',
    empty: 'No data yet — play a few matches!',
    pickPlayer: 'Pick a player',
    matchesPlayed: 'Matches played',
    matchesWon: 'Wins',
    winRate: 'Win rate',
    podiums: 'Podiums',
    accuracy: 'Accuracy',
    avgScore: 'Average score',
    avgScorePerThrow: 'Avg score / throw',
    bestStreak: 'Best streak',
    exactFifties: 'Exact 50s',
    overshoots: 'Overshoots',
    topPin: 'Favourite pin',
    none: '—',
    pinFrequency: 'Pins hit',
  },
  players: {
    title: 'Players',
    addPlayer: 'Add a player',
    name: 'Name',
    color: 'Colour',
    avatar: 'Photo',
    pickAvatar: 'Pick a photo',
    clearAvatar: 'Remove photo',
    removeConfirm: 'Remove {name} from the roster?',
    empty: 'No saved players yet',
    emptyHint: 'Add your regulars to start games faster.',
  },
  settings: {
    title: 'Settings',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    language: 'Language',
    sounds: 'Sounds',
    vibrations: 'Vibrations',
    wakeLock: 'Keep screen awake during a match',
    wakeLockHint:
      'The screen stays on as long as a match is in progress (Android / iOS Safari supported).',
    export: 'Export my data (JSON)',
    import: 'Import a file',
    importFailed: 'Import failed',
    importApplied: '{n} match(es) imported',
    eraseAll: 'Erase all data',
    eraseAllConfirm: 'Permanently delete all players, matches and settings?',
    about: 'About',
    aboutText:
      'Mister Mölkky — offline app, your data stays on your device.',
    version: 'Version',
  },
  install: {
    text: 'Install this app on your device?',
    button: 'Install',
    dismiss: 'Later',
  },
  offline: {
    title: 'Offline — your data is saved locally.',
  },
  welcome: {
    title: 'Welcome to Mister Mölkky',
    p1: '12 pins, 2 to 16 players, first to exactly 50 wins.',
    p2: 'Tap fallen pins after each throw.',
    p3: 'Going over 50 → score back to 25.',
    p4: '3 misses in a row → you are out.',
    cta: 'Let’s go!',
    skip: 'Skip',
  },
  toast: {
    undo: 'Action undone',
    saved: 'Saved',
    copied: 'Copied to clipboard',
    shared: 'Shared',
    failed: 'Action failed',
  },
  a11y: {
    pinAt: 'Pin number {n}, {state}',
    score: 'Score: {n} points',
    closeDialog: 'Close dialog',
    fullscreen: 'Enter fullscreen',
    exitFullscreen: 'Exit fullscreen',
  },
};

export const messages: Record<Locale, Messages> = { fr, en };
