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
    templates: string;
    templatesEmpty: string;
    templateUseConfirm: string;
    templateDelete: string;
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
    turnOrderTitle: string;
    shuffleNow: string;
    targetScore: string;
    overshootPenalty: string;
    maxMisses: string;
    teamMode: string;
    teamSolo: string;
    teamDuo: string;
    teamTrio: string;
    missSanction: string;
    missSanctionElimination: string;
    missSanctionEliminationHint: string;
    missSanctionReset: string;
    missSanctionResetHint: string;
    missSanctionNone: string;
    missSanctionNoneHint: string;
    recap: string;
    startMatch: string;
    needMinPlayers: string;
    needMinPlayersHint: string;
    saveAsTemplate: string;
    templateNamePlaceholder: string;
    templateSaved: string;
    variant: string;
    variantClassic: string;
    variantInverse: string;
    variantFree: string;
    variantClassicHint: string;
    variantInverseHint: string;
    variantFreeHint: string;
  };
  match: {
    rematch: string;
    throwsLog: string;
    throwsLogEmpty: string;
    editThrow: string;
    editThrowHint: string;
    throwNumber: string;
    fallenPins: string;
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
    forfeitPlayer: string;
    forfeitPlayerTitle: string;
    forfeitPlayerHint: string;
    forfeitConfirm: string;
    forfeitNoActive: string;
    forfeit: string;
    forfeitedBadge: string;
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
    headToHead: string;
    headToHeadPickFirst: string;
    headToHeadPickSecond: string;
    headToHeadMatches: string;
    headToHeadNoMatches: string;
    achievements: string;
    achievementsEmpty: string;
  };
  achievements: {
    firstFifty: string;
    firstFiftyDesc: string;
    threeInARow: string;
    threeInARowDesc: string;
    fastWin: string;
    fastWinDesc: string;
    perfectGame: string;
    perfectGameDesc: string;
    veteran: string;
    veteranDesc: string;
    comeback: string;
    comebackDesc: string;
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
    outdoor: string;
    outdoorHint: string;
    colorblind: string;
    colorblindHint: string;
    export: string;
    import: string;
    importFailed: string;
    importApplied: string;
    eraseAll: string;
    eraseAllConfirm: string;
    forceUpdate: string;
    forceUpdateHint: string;
    forceUpdateInProgress: string;
    about: string;
    aboutText: string;
    version: string;
  };
  install: {
    text: string;
    button: string;
    dismiss: string;
  };
  live: {
    shareTitle: string;
    shareIntro: string;
    shareHint: string;
    shareText: string;
    startSharing: string;
    stopSharing: string;
    codeLabel: string;
    qrAlt: string;
    activeBadge: string;
    notConfigured: string;
    join: string;
    joinTitle: string;
    joinHint: string;
    joinScan: string;
    joinCancelScan: string;
    joinSubmit: string;
    joinFailed: string;
    spectatorTitle: string;
    spectatorLive: string;
    spectatorFinished: string;
    spectatorLeave: string;
    settingsTitle: string;
    settingsConfigured: string;
    settingsNotConfigured: string;
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
    templates: 'Mes templates',
    templatesEmpty:
      'Aucun template enregistré. Lance une partie et sauvegarde-la pour la rejouer en 1 tap.',
    templateUseConfirm: 'Lancer une partie avec ce template ?',
    templateDelete: 'Supprimer ce template ?',
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
    shuffleOrder: 'Mélanger l’ordre au lancement',
    turnOrderTitle: 'Ordre de passage',
    shuffleNow: 'Aléatoire',
    targetScore: 'Score à atteindre',
    overshootPenalty: 'Score en cas de dépassement',
    maxMisses: 'Ratés consécutifs avant sanction',
    teamMode: 'Format',
    teamSolo: 'Individuel',
    teamDuo: 'Duo',
    teamTrio: 'Trio',
    missSanction: 'Sanction après {n} ratés',
    missSanctionElimination: 'Élimination',
    missSanctionEliminationHint:
      'Règle Mölkky officielle : le joueur est éliminé.',
    missSanctionReset: 'Remise à zéro',
    missSanctionResetHint: 'Le score retombe au départ, le joueur continue.',
    missSanctionNone: 'Aucune sanction',
    missSanctionNoneHint:
      'Le compteur de ratés s’affiche mais ne pénalise pas.',
    recap: 'Récapitulatif',
    startMatch: 'Démarrer la partie',
    needMinPlayers: 'Sélectionnez au moins 2 joueurs',
    needMinPlayersHint:
      'Créez d’abord des joueurs depuis l’onglet Joueurs si vous n’en avez pas.',
    saveAsTemplate: 'Enregistrer comme template',
    templateNamePlaceholder: 'Nom du template (ex. soirée du jeudi)',
    templateSaved: 'Template enregistré',
    variant: 'Variante',
    variantClassic: 'Classique',
    variantInverse: 'Inversée',
    variantFree: 'Libre',
    variantClassicHint: '0 → 50 pile pour gagner, dépassement = 25.',
    variantInverseHint: '50 → 0 pile pour gagner, dépassement = +5.',
    variantFreeHint:
      'Pas de retour à 25 sur dépassement (passe juste au tour suivant).',
  },
  match: {
    rematch: 'Rejouer mêmes joueurs',
    throwsLog: 'Tous les lancers',
    throwsLogEmpty: 'Aucun lancer encore.',
    editThrow: 'Modifier ce lancer',
    editThrowHint: 'Sélectionne les quilles tombées',
    throwNumber: 'Lancer #{n}',
    fallenPins: 'Quilles tombées',
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
    abandon: 'Abandonner la partie',
    abandonConfirm: 'Abandonner la partie en cours ?',
    forfeitPlayer: 'Faire abandonner un joueur',
    forfeitPlayerTitle: 'Qui abandonne ?',
    forfeitPlayerHint:
      'Le joueur est sorti de la partie ; les autres continuent.',
    forfeitConfirm: 'Faire abandonner {name} ?',
    forfeitNoActive: 'Aucun joueur encore en lice.',
    forfeit: 'Abandonner',
    forfeitedBadge: 'Abandon',
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
    headToHead: 'Face-à-face',
    headToHeadPickFirst: 'Choisir le 1ᵉʳ joueur',
    headToHeadPickSecond: 'Choisir le 2ᵉ joueur',
    headToHeadMatches: '{n} parties communes',
    headToHeadNoMatches: 'Aucune partie commune entre ces deux joueurs',
    achievements: 'Badges',
    achievementsEmpty: 'Aucun badge débloqué pour le moment.',
  },
  achievements: {
    firstFifty: 'Premier pile 50',
    firstFiftyDesc:
      'Gagner une partie en atteignant exactement le score cible.',
    threeInARow: 'Triplé',
    threeInARowDesc: '3 victoires consécutives.',
    fastWin: 'Victoire éclair',
    fastWinDesc: 'Gagner une partie en moins de 10 lancers.',
    perfectGame: 'Partie parfaite',
    perfectGameDesc: 'Gagner sans manquer un seul lancer.',
    veteran: 'Vétéran',
    veteranDesc: '10 parties jouées.',
    comeback: 'Remontada',
    comebackDesc: 'Gagner après un dépassement de score.',
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
    outdoor: 'Mode extérieur (gros bouton)',
    outdoorHint: 'Quilles agrandies et contraste poussé pour jouer au soleil.',
    colorblind: 'Mode daltonien',
    colorblindHint: 'Ajoute des symboles (★ ▲ ●) en plus des couleurs.',
    export: 'Exporter mes données (JSON)',
    import: 'Importer un fichier',
    importFailed: 'Import impossible',
    importApplied: '{n} match(es) importé(s)',
    eraseAll: 'Effacer toutes les données',
    eraseAllConfirm:
      'Supprimer définitivement tous les joueurs, parties et réglages ?',
    forceUpdate: 'Forcer la mise à jour',
    forceUpdateHint:
      'Vide le cache du service worker et recharge l’app pour récupérer la dernière version déployée.',
    forceUpdateInProgress: 'Mise à jour…',
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
  live: {
    shareTitle: 'Diffuser en direct',
    shareIntro:
      'Génère un code partageable pour que d’autres devices puissent suivre cette partie en temps réel.',
    shareHint: 'Scanne le QR ou saisis le code dans « Rejoindre une partie ».',
    shareText: 'Suis ma partie de Mölkky avec le code {code}',
    startSharing: 'Démarrer la diffusion',
    stopSharing: 'Arrêter la diffusion',
    codeLabel: 'Code',
    qrAlt: 'QR code à scanner',
    activeBadge: 'En direct',
    notConfigured:
      'Le mode direct nécessite un backend Supabase configuré. Voir docs/live-supabase.md.',
    join: 'Rejoindre une partie',
    joinTitle: 'Rejoindre une partie en direct',
    joinHint: 'Entre le code à 6 caractères ou scanne le QR du téléphone hôte.',
    joinScan: 'Scanner le QR',
    joinCancelScan: 'Annuler le scan',
    joinSubmit: 'Rejoindre',
    joinFailed: 'Code introuvable',
    spectatorTitle: 'Suivi en direct',
    spectatorLive: 'En direct',
    spectatorFinished: 'Partie terminée',
    spectatorLeave: 'Quitter',
    settingsTitle: 'Mode direct',
    settingsConfigured:
      'Backend configuré — tu peux diffuser ou rejoindre des parties.',
    settingsNotConfigured:
      'Backend non configuré. Voir docs/live-supabase.md pour activer.',
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
    templates: 'My templates',
    templatesEmpty:
      'No saved templates yet. Start a match and save it to replay in one tap.',
    templateUseConfirm: 'Start a match from this template?',
    templateDelete: 'Delete this template?',
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
    shuffleOrder: 'Shuffle order when the match starts',
    turnOrderTitle: 'Turn order',
    shuffleNow: 'Shuffle',
    targetScore: 'Target score',
    overshootPenalty: 'Score after overshoot',
    maxMisses: 'Consecutive misses before sanction',
    teamMode: 'Format',
    teamSolo: 'Solo',
    teamDuo: 'Pairs',
    teamTrio: 'Trios',
    missSanction: 'Sanction after {n} misses',
    missSanctionElimination: 'Elimination',
    missSanctionEliminationHint: 'Official Mölkky rule: the player is out.',
    missSanctionReset: 'Reset score',
    missSanctionResetHint: 'Score drops back to start, player keeps going.',
    missSanctionNone: 'No sanction',
    missSanctionNoneHint: 'Miss counter still shown but never penalises.',
    recap: 'Recap',
    startMatch: 'Start match',
    needMinPlayers: 'Pick at least 2 players',
    needMinPlayersHint:
      'Create players from the Players tab first if you don’t have any.',
    saveAsTemplate: 'Save as template',
    templateNamePlaceholder: 'Template name (e.g. Thursday night)',
    templateSaved: 'Template saved',
    variant: 'Variant',
    variantClassic: 'Classic',
    variantInverse: 'Reverse',
    variantFree: 'Free',
    variantClassicHint: '0 → exactly 50 wins, overshoot drops to 25.',
    variantInverseHint: '50 → exactly 0 wins, overshoot adds 5.',
    variantFreeHint: 'No drop-to-25 on overshoot (turn just ends).',
  },
  match: {
    rematch: 'Replay same players',
    throwsLog: 'All throws',
    throwsLogEmpty: 'No throws yet.',
    editThrow: 'Edit this throw',
    editThrowHint: 'Tap the fallen pins',
    throwNumber: 'Throw #{n}',
    fallenPins: 'Fallen pins',
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
    abandon: 'Abandon match',
    abandonConfirm: 'Abandon the current match?',
    forfeitPlayer: 'Forfeit a player',
    forfeitPlayerTitle: 'Who forfeits?',
    forfeitPlayerHint: 'The player drops out; others keep playing.',
    forfeitConfirm: 'Forfeit {name}?',
    forfeitNoActive: 'No active players left.',
    forfeit: 'Forfeit',
    forfeitedBadge: 'Forfeit',
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
    headToHead: 'Head-to-head',
    headToHeadPickFirst: 'Pick first player',
    headToHeadPickSecond: 'Pick second player',
    headToHeadMatches: '{n} shared matches',
    headToHeadNoMatches: 'These two players never met in a match',
    achievements: 'Badges',
    achievementsEmpty: 'No badges unlocked yet.',
  },
  achievements: {
    firstFifty: 'First exact 50',
    firstFiftyDesc: 'Win a match by hitting exactly the target score.',
    threeInARow: 'Hat-trick',
    threeInARowDesc: '3 wins in a row.',
    fastWin: 'Quick win',
    fastWinDesc: 'Win a match in fewer than 10 throws.',
    perfectGame: 'Perfect game',
    perfectGameDesc: 'Win without missing a single throw.',
    veteran: 'Veteran',
    veteranDesc: '10 matches played.',
    comeback: 'Comeback',
    comebackDesc: 'Win after an overshoot.',
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
    outdoor: 'Outdoor mode (bigger pins)',
    outdoorHint: 'Larger pins and boosted contrast for daylight play.',
    colorblind: 'Colourblind mode',
    colorblindHint: 'Adds symbols (★ ▲ ●) in addition to colours.',
    export: 'Export my data (JSON)',
    import: 'Import a file',
    importFailed: 'Import failed',
    importApplied: '{n} match(es) imported',
    eraseAll: 'Erase all data',
    eraseAllConfirm: 'Permanently delete all players, matches and settings?',
    forceUpdate: 'Force update',
    forceUpdateHint:
      'Clears the service worker cache and reloads the app to grab the latest deployed version.',
    forceUpdateInProgress: 'Updating…',
    about: 'About',
    aboutText: 'Mister Mölkky — offline app, your data stays on your device.',
    version: 'Version',
  },
  install: {
    text: 'Install this app on your device?',
    button: 'Install',
    dismiss: 'Later',
  },
  live: {
    shareTitle: 'Share live',
    shareIntro:
      'Generate a shareable code so other devices can follow this match in real time.',
    shareHint: 'Scan the QR code or enter the code in "Join a match".',
    shareText: 'Follow my Mölkky match with code {code}',
    startSharing: 'Start sharing',
    stopSharing: 'Stop sharing',
    codeLabel: 'Code',
    qrAlt: 'QR code to scan',
    activeBadge: 'Live',
    notConfigured:
      'Live mode needs a configured Supabase backend. See docs/live-supabase.md.',
    join: 'Join a match',
    joinTitle: 'Join a live match',
    joinHint: 'Enter the 6-character code or scan the host phone QR.',
    joinScan: 'Scan QR',
    joinCancelScan: 'Cancel scan',
    joinSubmit: 'Join',
    joinFailed: 'Code not found',
    spectatorTitle: 'Following live',
    spectatorLive: 'Live',
    spectatorFinished: 'Match finished',
    spectatorLeave: 'Leave',
    settingsTitle: 'Live mode',
    settingsConfigured: 'Backend configured — you can share or join matches.',
    settingsNotConfigured:
      'Backend not configured. See docs/live-supabase.md to enable.',
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
