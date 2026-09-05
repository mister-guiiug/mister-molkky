# Prompt — Mister Mölkky (PWA)

> **À l'agent qui exécute ce prompt** : ce document est un brief de développement
> autonome. Lis-le intégralement avant la première action. Toutes les décisions
> structurantes (stack, arborescence, conventions) y sont fixées ; tu n'as plus
> qu'à les appliquer dans le dossier `mister-molkky/`.
>
> **Source de vérité** : la famille `miss-*` / `mister-*` de
> `C:\Src\GithubMister`. **Inspire-toi en priorité de `miss-badminton/`** (même
> jeu de scoring, même cible mobile, mêmes patterns Rive). Quand tu doutes,
> reproduis la convention `miss-badminton` plutôt que d'inventer.

---

## 1. Mission

Construire **Mister Mölkky**, une PWA mobile-first, 100 % offline, qui permet de
gérer une partie de **Mölkky** (jeu de quilles finlandais) entre 2 à 16
joueurs / équipes. L'app doit :

- compter les points automatiquement (additions, ramener à 25 en cas de
  dépassement de 50, éliminations à 3 ratés consécutifs),
- afficher les 12 quilles dans un layout fidèle au plan de quilles réel,
- animer chaque tir (quilles qui tombent, score qui s'incrémente) façon
  **Rive**,
- mémoriser l'historique des parties, les statistiques par joueur (taux de
  victoire, précision, score moyen, série la plus longue, etc.),
- s'installer comme application native (Android / iOS / desktop),
- fonctionner **hors-ligne** dès la première installation.

**Cibles concurrentielles** (faire au moins aussi bien) :

- _Mölkky® Game Tracker_ (Tactic Games, com.tacticgames.molkkyscoretracker)
- _Mölkky Champion: Score & Stats_ (Vincent Guillebaud, io.github.vinceglb.molkky)

---

## 2. Stack imposée (famille `mister-guiiug`)

Reprendre **strictement** la stack de `dev-pwa-config@^1.2.0` et le squelette
de `miss-badminton/` :

| Couche          | Choix                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| Build           | **Vite 7**                                                                       |
| Framework       | **React 19** (function components, hooks, `StrictMode`)                          |
| Langage         | **TypeScript ~6.0.2 strict**, cible ES2025                                       |
| Styling         | **Tailwind CSS 4** via `@tailwindcss/vite` + tokens famille                      |
| Routing         | **react-router-dom 7** (`BrowserRouter` + `basename`)                            |
| État global     | **Zustand 5** + `persist` + `createJSONStorage`                                  |
| Validation      | **Zod 3** (schémas dans `src/schemas.ts`)                                        |
| Storage         | `localStorage` (Zustand persist) + `IndexedDB` (photos / blobs via `src/idb.ts`) |
| PWA             | **vite-plugin-pwa** (mode `prompt`, Workbox)                                     |
| Animations      | **@rive-app/react-canvas 4** (cf. § 8)                                           |
| Tests unitaires | **Vitest 3** (jsdom + globals)                                                   |
| Tests E2E       | **Playwright** (smoke + critical + a11y)                                         |
| Lint / Format   | ESLint 9 flat + Prettier 3.6 (via `dev-pwa-config`)                              |
| Hooks Git       | Husky + lint-staged + commitlint (Conventional Commits)                          |
| i18n            | provider maison `I18nProvider` (cf. `miss-badminton/src/i18n/`)                  |
| Déploiement     | GitHub Pages via reusable workflow `pwa-deploy.yml`                              |

### 2.1. Dépendances famille à consommer telles quelles

```jsonc
// package.json — devDependencies
"@mister-guiiug/dev-pwa-config": "^1.2.0"
```

Et dans la racine du projet, créer `.npmrc` :

```ini
@mister-guiiug:registry=https://npm.pkg.github.com
```

Consommer **tous** les exports utiles :

- `eslint.config.js` → ré-exporter `eslint-react`
- `prettier.config.js` → ré-exporter `prettier`
- `tsconfig.app.json` → étendre `tsconfig-app-react`
- `tsconfig.node.json` → étendre `tsconfig-node`
- `vitest.config.ts` → consommer `vitest-base`
- `playwright.config.ts` → consommer `playwright-base`
- `commitlint.config.js` + `lint-staged.config.js` → ré-exporter
- `src/index.css` → importer `@mister-guiiug/dev-pwa-config/tailwind-preset.css`

### 2.2. Squelette à dupliquer depuis `miss-badminton/`

Fichiers à **recopier puis adapter** (changer `miss-badminton` → `mister-molkky`
et `Miss Badminton` → `Mister Mölkky`) :

```
.editorconfig            .gitattributes           .gitignore
.lighthouserc.json       .lintstagedrc.json       .npmrc
.nvmrc                   eslint.config.js         index.html
prettier.config.js       renovate.json            tsconfig.app.json
tsconfig.json            tsconfig.node.json       vite.config.ts
vitest.config.ts         playwright.config.ts     .husky/
.github/                 .vscode/                 scripts/generate-pwa-icons.mjs
src/main.tsx             src/register-sw.ts       src/theme.ts
src/error-reporter.ts    src/idb.ts               src/migrations.ts (vidé)
src/share.ts             src/storage.ts (vidé)    src/styles.css
src/tailwind.css         src/vite-env.d.ts        src/test/setup.ts
src/react/AppRouter.tsx  src/react/components/layout/Shell.tsx
src/react/components/RiveScene.tsx                src/i18n/*
```

Conserver l'**organisation** (`src/react/{components,views,hooks}` +
`src/store/` + `src/i18n/` + `src/assets/rive/` + `public/icons/`).

---

## 3. Règles du Mölkky à implémenter

Référence : [molkky.com](https://molkky.com) et règles FIM. Encoder les règles
dans un module pur **`src/molkky/rules.ts`** (testé exhaustivement, > 95 %
couverture).

### 3.1. Setup

- **12 quilles** numérotées de **1 à 12**, disposées en plan de quilles initial
  (voir § 5.4 pour le layout exact).
- **2 à 16 joueurs ou équipes** (`PlayerId[]`), ordre de jeu = ordre de
  saisie ; pouvoir mélanger aléatoirement avant le premier lancer.
- Score de victoire par défaut : **50** (paramétrable 25 / 50 / 100).
- Score de retour en cas de dépassement : **25** (paramétrable).

### 3.2. Lancer ⇒ Score

À chaque lancer, le joueur saisit le résultat. 3 cas :

1. **Une seule quille tombe** → score = numéro de la quille (1 à 12).
2. **Plusieurs quilles tombent** → score = **nombre de quilles tombées**
   (entre 2 et 12).
3. **Aucune quille tombée** → 0 point + +1 _miss streak_.

Une quille est "tombée" si elle est entièrement au sol (UI : tap pour basculer
son état avant validation du tir).

### 3.3. Dépassement de 50

- Si `totalActuel + lancer > 50` → le score du joueur **retombe à 25** (ou
  valeur paramétrée).
- Si `totalActuel + lancer === 50` → **victoire immédiate**.

### 3.4. Élimination

- 3 lancers à 0 consécutifs (`missStreak >= 3`) → **joueur éliminé**.
- Si tous les joueurs sauf un sont éliminés → le dernier gagne (peu importe son
  score).
- En partie en équipe, l'élimination s'applique à toute l'équipe (paramétrable
  : par joueur ou par équipe).

### 3.5. Replacement des quilles

- Si **1 seule** quille tombe → on la remet **debout sur place** (où elle est
  tombée → mais pour l'app, simplification : reset à la position initiale).
- Si **≥ 2** quilles tombent → toutes redressées **à leur position initiale**.

> Pour le MVP, on simplifie : après chaque tir validé, les quilles tombées sont
> remises à leur position initiale (animation Rive « stand up » jouée à
> l'envers).

### 3.6. Fin de partie

- Le premier joueur à **50 pts exactement** gagne.
- Si seul un joueur n'est pas éliminé, il gagne immédiatement.
- Le classement final est : gagnant en 1ᵉʳ, puis les autres triés par score
  décroissant, éliminés en dernier (ordre d'élimination).

### 3.7. Tableau de tests unitaires (`rules.test.ts`)

Minimum à couvrir :

| Cas                             | Entrée               | Score attendu |
| ------------------------------- | -------------------- | ------------- |
| 1 quille → numéro               | quilles=[7]          | 7             |
| 2 quilles → nombre              | quilles=[3,9]        | 2             |
| 5 quilles → nombre              | quilles=[1,2,4,8,11] | 5             |
| 0 quille → 0                    | quilles=[]           | 0             |
| Dépassement 50 → 25             | total=45, +12        | 25            |
| Pile 50 → victoire              | total=42, +8         | 50 + winner   |
| 3 ratés → élimination           | missStreak=2, +0     | éliminé       |
| Tous éliminés sauf 1 → victoire | n=4, 3 éliminés      | winner        |

---

## 4. Modèle de données (Zod)

Tout dans `src/schemas.ts`. Persister via Zustand `persist` (`mm_` prefix sur
les clés localStorage) + IDB pour les avatars (Blob).

```ts
// Identifiants
export const PlayerIdSchema = z.string().uuid().brand<'PlayerId'>();
export const MatchIdSchema = z.string().uuid().brand<'MatchId'>();

// Joueur (persistant entre parties)
export const PlayerSchema = z.object({
  id: PlayerIdSchema,
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9a-f]{6}$/i), // couleur d'équipe
  avatarBlobKey: z.string().optional(), // référence IDB
  createdAt: z.number().int(),
});

// Configuration de partie
export const MatchConfigSchema = z.object({
  players: z.array(PlayerSchema).min(2).max(16),
  targetScore: z.union([z.literal(25), z.literal(50), z.literal(100)]),
  overshootPenalty: z.number().int().min(0).max(50).default(25),
  maxMisses: z.number().int().min(1).max(5).default(3),
  teamMode: z.enum(['solo', 'duo', 'trio']).default('solo'),
  shufflePlayers: z.boolean().default(false),
});

// Un lancer (event source de vérité — on dérive tout depuis cette liste)
export const ThrowSchema = z.object({
  id: z.string().uuid(),
  playerId: PlayerIdSchema,
  timestamp: z.number().int(),
  fallenPins: z.array(z.number().int().min(1).max(12)), // n° des quilles
  computedScore: z.number().int().min(0).max(12), // dérivé
  resultedInElimination: z.boolean().default(false),
  resultedInOvershoot: z.boolean().default(false),
});

// Partie terminée (entrée d'historique)
export const FinishedMatchSchema = z.object({
  id: MatchIdSchema,
  config: MatchConfigSchema,
  throws: z.array(ThrowSchema),
  startedAt: z.number().int(),
  finishedAt: z.number().int(),
  winnerId: PlayerIdSchema,
  ranking: z.array(
    z.object({
      playerId: PlayerIdSchema,
      finalScore: z.number().int(),
      eliminated: z.boolean(),
      rank: z.number().int().min(1),
    })
  ),
});

// Bundle d'export (JSON shareable)
export const ExportBundleSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number().int(),
  players: z.array(PlayerSchema),
  matches: z.array(FinishedMatchSchema),
});
```

**Statistiques dérivées par joueur** (calculées à la volée, jamais stockées) :

- nombre de parties jouées / gagnées / podium
- taux de victoire (`win / played`)
- score moyen final
- précision = `pinsHit / totalThrows`
- score moyen par lancer
- meilleure série (consécutifs sans rater)
- nombre de "pile 50" et de "dépassements"
- quille préférée (la plus souvent tombée individuellement)

---

## 5. Architecture cible

### 5.1. Arborescence

```
mister-molkky/
├── public/
│   ├── icons/              # généré par scripts/generate-pwa-icons.mjs
│   ├── logo.png            # logo de marque (source des icônes)
│   └── robots.txt
├── src/
│   ├── assets/
│   │   └── rive/
│   │       ├── README.md
│   │       ├── pins.riv       # plan de 12 quilles + chute
│   │       └── score-pop.riv  # incrément animé
│   ├── i18n/
│   │   ├── I18nProvider.tsx
│   │   ├── context.ts
│   │   ├── useI18n.ts
│   │   ├── messages.ts        # fr (défaut) + en
│   │   └── messages.test.ts
│   ├── molkky/                # ⚠ logique pure, zéro React
│   │   ├── rules.ts
│   │   ├── rules.test.ts
│   │   ├── ranking.ts
│   │   ├── stats.ts
│   │   └── stats.test.ts
│   ├── react/
│   │   ├── AppRouter.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Shell.tsx
│   │   │   │   └── PageContainer.tsx
│   │   │   ├── icons.tsx
│   │   │   ├── Logo.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── RiveScene.tsx
│   │   │   ├── PinsBoard.tsx           # § 5.4
│   │   │   ├── PinsBoardRive.tsx       # variante full-Rive
│   │   │   ├── ScoreTicker.tsx         # § 8.2
│   │   │   ├── PlayerCard.tsx
│   │   │   ├── PlayerOrderList.tsx
│   │   │   ├── MatchSetupWizard.tsx    # parcours 3 étapes
│   │   │   ├── ThrowResultSheet.tsx    # bottom sheet validation
│   │   │   ├── EliminationToast.tsx
│   │   │   ├── VictoryConfetti.tsx
│   │   │   ├── PwaInstallPrompt.tsx
│   │   │   ├── OfflineIndicator.tsx
│   │   │   ├── FullscreenToggle.tsx
│   │   │   ├── WelcomeTutorial.tsx
│   │   │   └── OnboardingHint.tsx
│   │   ├── hooks/
│   │   │   ├── useFeedback.ts          # vibration + sons
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   ├── useLongPress.ts
│   │   │   ├── usePullToRefresh.ts
│   │   │   └── useSwipeDown.ts
│   │   └── views/
│   │       ├── HomeView.tsx
│   │       ├── MatchView.tsx           # cœur de l'app
│   │       ├── HistoryView.tsx
│   │       ├── StatsView.tsx           # spécifique Mölkky
│   │       ├── PlayersView.tsx         # CRUD joueurs persistants
│   │       └── SettingsView.tsx
│   ├── store/
│   │   ├── useMatchStore.ts            # partie en cours + historique
│   │   ├── useMatchStore.test.ts
│   │   ├── usePlayersStore.ts          # roster persistant
│   │   └── useSettingsStore.ts         # thème, langue, sons, vibrations
│   ├── test/
│   │   └── setup.ts
│   ├── error-reporter.ts
│   ├── idb.ts
│   ├── migrations.ts
│   ├── register-sw.ts
│   ├── routes.ts
│   ├── schemas.ts
│   ├── share.ts                        # export JSON / lien replay
│   ├── storage.ts
│   ├── styles.css
│   ├── tailwind.css
│   ├── theme.ts
│   ├── vite-env.d.ts
│   └── main.tsx
├── e2e/
│   ├── home.spec.ts
│   ├── match.spec.ts
│   └── stats.spec.ts
├── docs/
│   ├── context.md                      # bref pitch produit
│   └── rive-pins.md                    # spec de l'animation
├── scripts/
│   └── generate-pwa-icons.mjs
├── index.html
├── package.json
├── README.md
├── LICENSE
└── (configs)
```

### 5.2. Routes

| Path            | View           | Lazy ? |
| --------------- | -------------- | ------ |
| `/`             | `HomeView`     | non    |
| `/partie`       | `MatchView`    | oui    |
| `/historique`   | `HistoryView`  | oui    |
| `/statistiques` | `StatsView`    | oui    |
| `/joueurs`      | `PlayersView`  | oui    |
| `/parametres`   | `SettingsView` | oui    |

Garder les alias anglais (`/match`, `/history`, `/stats`, `/players`,
`/settings`) en `<Navigate replace />` comme dans `miss-badminton`.

### 5.3. Vue principale `MatchView` (layout mobile)

```
┌─────────────────────────────────────┐
│  ⏸  Tour de :  💚 Alice   ⏱ 03:42  │   Header sticky (joueur courant, chrono)
├─────────────────────────────────────┤
│                                     │
│       [Plan de quilles 12 + Rive]   │   PinsBoard — tap pour basculer
│                                     │   quille tombée / debout
│                                     │
├─────────────────────────────────────┤
│   🎯 Score du tir : +7              │   ScoreTicker (animation)
│   [   Valider le tir   ]            │   CTA pleine largeur
│   [ Raté (0 pt) ] [ Annuler ]       │
├─────────────────────────────────────┤
│  Scoreboard (carrousel horizontal)  │
│  ┌──────┐ ┌──────┐ ┌──────┐         │
│  │Alice │ │Bob   │ │Carol │ ...     │
│  │ 42   │ │ 25   │ │ 38   │         │
│  │ ●○○  │ │ ●●○  │ │ ●○○  │ misses  │
│  └──────┘ └──────┘ └──────┘         │
└─────────────────────────────────────┘
```

Toolbar haute : pause / chrono / menu (undo, restart, abandon, partager).

### 5.4. Layout des quilles (plan officiel)

Le plan de quilles Mölkky en début de partie est codé en dur :

```
        7   9   8
      5  11   12  6
        3   10   4
          1   2
              ← tireur (Mölkky thrown from here)
```

Encoder en coordonnées `{x: 0..4, y: 0..3}` dans
`src/molkky/pins-layout.ts` :

```ts
export const INITIAL_LAYOUT: readonly { pin: number; x: number; y: number }[] =
  [
    { pin: 1, x: 1.5, y: 0 },
    { pin: 2, x: 2.5, y: 0 },
    { pin: 3, x: 1, y: 1 },
    { pin: 10, x: 2, y: 1 },
    { pin: 4, x: 3, y: 1 },
    { pin: 5, x: 0.5, y: 2 },
    { pin: 11, x: 1.5, y: 2 },
    { pin: 12, x: 2.5, y: 2 },
    { pin: 6, x: 3.5, y: 2 },
    { pin: 7, x: 1, y: 3 },
    { pin: 9, x: 2, y: 3 },
    { pin: 8, x: 3, y: 3 },
  ];
```

---

## 6. Fonctionnalités MVP (P0) et roadmap

### P0 — strictement nécessaire au lancement

- [ ] Splash + onboarding (`WelcomeTutorial`) avec règles résumées
- [ ] CRUD joueurs persistants (`/joueurs`) avec nom + couleur + photo
      (caméra ou galerie, stockée en IDB)
- [ ] Wizard de création de partie (3 étapes) : 1. Choix des joueurs (chips, drag-to-reorder, "mélanger") 2. Score cible (25 / 50 / 100), pénalité dépassement, max ratés 3. Récap + démarrer
- [ ] `MatchView` complète avec `PinsBoard` interactif et `ScoreTicker`
- [ ] Calcul automatique des règles (`molkky/rules.ts`)
- [ ] Undo / refaire (basé sur le tableau de `throws`)
- [ ] Bannière d'élimination + animation
- [ ] Confettis + écran de victoire avec classement final
- [ ] Sauvegarde automatique de la partie en cours (`mm_currentMatch`)
- [ ] Historique des parties (`/historique`) avec recherche / filtres
- [ ] Statistiques par joueur (`/statistiques`)
- [ ] Thème clair / sombre + suivi système, anti-FOUC
- [ ] i18n FR + EN
- [ ] PWA installable, offline-first
- [ ] Wake Lock pendant la partie (écran reste allumé)
- [ ] Vibration légère à chaque tir validé (paramétrable)
- [ ] Plein écran (`FullscreenToggle`)

### P1 — différenciants

- [ ] Mode équipes (`teamMode: 'duo' | 'trio'`) avec scores partagés
- [ ] Règles maison sauvegardables comme **templates**
- [ ] Export / import JSON (utile pour synchroniser entre appareils
      sans backend)
- [ ] Lien `?replay=…` pour partager une config de partie
- [ ] Heatmap des quilles préférées par joueur
- [ ] Sparkline d'évolution du score pendant la partie
- [ ] Sons configurables (boules qui tombent, victoire) — assets libres
- [ ] Tournoi multi-manches (round robin) — manche P2 si trop gros

### P2 — bonus

- [ ] Mode "arbitre" (un seul appareil pour tout le monde, vue grand écran)
- [ ] Achievements / badges (premier 50, 10 victoires, etc.)
- [ ] Export PDF du scoreboard final
- [ ] Sync optionnelle Supabase (compte cloud) — **garder l'offline-first**

---

## 7. UX / UI

- **Mobile-first**, design proche `miss-badminton` : grandes cibles tactiles
  (mini 56 px), typo grasse, couleurs vives par joueur, contraste AA mini.
- **Tailwind 4** uniquement — variables CSS pour les couleurs sémantiques
  (`--primary`, `--surface`, `--surface-highlight`, `--border`, `--text`,
  `--muted`).
- Thème par défaut : **vert bouleau / bois clair** (référence finlandaise) →
  `--primary: #4a7c2a` (clair) / `#6da943` (sombre).
- Accessibilité : `aria-live` pour les changements de score, `aria-label`
  exhaustifs, focus visible, navigation clavier (flèches pour bascule
  quilles, espace pour valider, Z pour undo).
- Pas de bibliothèque UI (pas de Material, Chakra, etc.) — composants
  maison Tailwind.
- Toujours utiliser `var(--xxx)` pour les couleurs sémantiques, jamais de
  classes `text-blue-500` en dur.
- **Bottom sheet** pour la validation du tir (mobile-friendly).
- Toaster minimaliste pour les feedbacks (élimination, undo, partage).
- Confettis pour la victoire : animation Rive `victory.riv` + fallback CSS.

---

## 8. Animations Rive (comme `miss-badminton`)

### 8.1. Principe

- Tous les fichiers `.riv` vivent dans `src/assets/rive/` (jamais dans
  `public/`).
- Le composant `RiveScene` (à recopier depuis `miss-badminton`) **probe** le
  fichier (`.riv` magic header) avant de l'afficher, et tombe sur un
  **fallback React** s'il est absent → aucune 404, app fonctionnelle même
  sans les `.riv` (utile pour le dev avant que le designer les ait livrés).
- Runtime : `@rive-app/react-canvas` (latest 4.x).

### 8.2. Animations à prévoir

| Fichier `.riv`    | Artboard      | State machine | Inputs (entrées)                                                          | Utilisation               |
| ----------------- | ------------- | ------------- | ------------------------------------------------------------------------- | ------------------------- |
| `pins.riv`        | `PinsBoard`   | `Throw`       | `pin1Down`..`pin12Down` (bool), `reset` (trigger), `playerColor` (number) | Plan de 12 quilles animé  |
| `score-pop.riv`   | `ScoreTicker` | `Pop`         | `delta` (number), `play` (trigger)                                        | +N points qui surgit      |
| `victory.riv`     | `Victory`     | `Cheer`       | `playerColor` (number)                                                    | Plein écran fin de partie |
| `elimination.riv` | `Elim`        | `Out`         | `play` (trigger)                                                          | Bannière élimination      |
| `idle.riv`        | `Idle`        | `Idle`        | -                                                                         | Écran d'accueil (boucle)  |

Fallbacks **React purs** obligatoires pour les 5 (SVG + Tailwind animations)
— l'app doit être visuellement complète sans les `.riv`. Le rendu Rive est
une amélioration progressive.

### 8.3. PinsBoard — comportement

- 12 quilles SVG positionnées selon `INITIAL_LAYOUT` (§ 5.4).
- Tap sur une quille → bascule visuel debout ↔ tombée (animation Rive ou
  CSS : rotation 75° + désaturation + scale 0.9).
- Bouton "Valider" → joue l'animation Rive `Throw` avec les quilles tombées,
  puis incrémente le `ScoreTicker`, puis redresse après 600 ms.
- Bouton "Raté" → secoue l'écran (CSS `keyframes shake`) + son.
- Long press sur une quille → met TOUTES les autres en down (raccourci
  "strike").

### 8.4. ScoreTicker

- Affiche le score courant du joueur en gros (font weight 900).
- À chaque nouveau tir, animation : nombre qui défile (style odomètre) du
  score précédent au nouveau, en 400 ms avec easing `cubic-bezier(.2,.8,.2,1)`.
- Si dépassement → flash rouge + chute à 25 avec animation inverse.
- Si pile 50 → flash doré + trigger `victory.riv`.

### 8.5. Documentation Rive

Reprendre le `README.md` de `miss-badminton/src/assets/rive/README.md` en
adaptant le tableau des fichiers attendus. Ajouter un `docs/rive-pins.md`
qui décrit pour le designer le state machine attendu (inputs, transitions).

---

## 9. PWA

Reprendre **à l'identique** `miss-badminton/vite.config.ts` (gestion du
`basePath` GitHub Pages, `registerType: 'prompt'`, middleware trailing-slash).

Manifest :

```ts
manifest: {
  id: basePath,
  name: 'Mister Mölkky',
  short_name: 'Mölkky',
  description: 'Compteur de points et statistiques pour le jeu de Mölkky',
  theme_color: '#4a7c2a',
  background_color: '#f5f5f0',
  display: 'standalone',
  orientation: 'portrait-primary',
  start_url: basePath,
  scope: basePath,
  lang: 'fr',
  icons: [...],
  categories: ['games', 'sports', 'utilities'],
}
```

CSP `meta` dans `index.html` : identique à `miss-badminton` (`default-src
'self'` + autoriser inline pour le script anti-FOUC et Tailwind JIT). Pas de
réseau externe : tout est local.

---

## 10. Tests

- Unitaires (`vitest`) :
  - `molkky/rules.test.ts` → couvrir TOUS les cas du tableau § 3.7
  - `molkky/stats.test.ts` → vérifier chaque stat dérivée
  - `store/useMatchStore.test.ts` → cycle complet d'une partie courte
  - `i18n/messages.test.ts` → présence des clés FR et EN
  - `schemas.test.ts` → round-trip parse / validate
- E2E (`@playwright/test`, tags `@critical` `@smoke` `@a11y`) :
  - `home.spec.ts @smoke` → app charge, manifest valide
  - `match.spec.ts @critical` → partie de bout en bout : 3 joueurs, victoire
    sur 50 pile, classement final correct
  - `stats.spec.ts` → après 2 parties, les stats reflètent les résultats
- Lighthouse CI (`.lighthouserc.json`) : seuils mini PWA 100, A11y 95,
  Perf 90, Best Practices 95, SEO 90 (mêmes seuils que `miss-badminton`).

---

## 11. CI / CD

Reprendre les fichiers `.github/workflows/` de `miss-badminton`, en utilisant
les reusable workflows famille :

- `.github/workflows/ci.yml` → consomme `mister-guiiug/dev-pwa-config/.github/workflows/pwa-ci.yml@v1`
- `.github/workflows/deploy.yml` → consomme
  `mister-guiiug/dev-pwa-config/.github/workflows/pwa-deploy.yml@v1`
- ⚠ **Permissions** au niveau du caller (`packages: read`, et pour deploy
  `pages: write` + `id-token: write`).
- ⚠ Pas de `concurrency: pages` côté caller (déjà géré par le reusable).

---

## 12. Conventions de code (non négociables)

- **Aucun commentaire narratif** ("// importe React", "// boucle sur les
  joueurs"…). Les commentaires expliquent les _intentions non évidentes_, les
  arbitrages, les contraintes externes — pas le code lui-même.
- Conventional Commits (vérifié par `commitlint`).
- Fichiers TS / TSX : `import type` quand pertinent (`erasableSyntaxOnly`
  désactivé pour ce projet, garder simple).
- Composants React : `function Foo() {}` named exports, jamais de `default`
  sauf pour le lazy loading des views.
- Hooks : un fichier = un hook, nom commençant par `use*`.
- Pas de `console.log` en prod : passer par `error-reporter.ts`.
- Pas de `any`, pas de `as` sans commentaire justifiant la coercition.
- Tailwind : ordonner les classes (recommandé via `prettier-plugin-tailwindcss`
  si déjà dans `dev-pwa-config`).

---

## 13. Plan d'exécution recommandé (ordre)

1. **Bootstrap** : copier le squelette `miss-badminton` (configs, `.github`,
   `.vscode`, `index.html`, `main.tsx`, `theme.ts`, `register-sw.ts`,
   `i18n/`, `error-reporter.ts`, `idb.ts`, `RiveScene.tsx`, `Shell.tsx`).
   Remplacer les noms / titres. `npm install`. `npm run dev` doit afficher
   un écran vide stylé.
2. **Domaine** : `src/molkky/rules.ts` + `rules.test.ts` (TDD). Atteindre
   100 % de couverture avant de passer à l'UI.
3. **Schémas + stores** : `schemas.ts`, `usePlayersStore`,
   `useMatchStore`, `useSettingsStore`. Tests de cycles de vie.
4. **PlayersView** (CRUD joueurs) + IDB pour les photos.
5. **HomeView** + `MatchSetupWizard`.
6. **MatchView** version "fallback" (sans Rive) : `PinsBoard` SVG,
   `ScoreTicker` CSS, validation complète des règles.
7. **Historique + Stats**.
8. **Animations Rive** : commander / dessiner les 5 fichiers `.riv`, brancher
   `RiveScene`, garder les fallbacks fonctionnels.
9. **PWA** : icônes (`npm run icons`), service worker, install prompt,
   wake lock.
10. **Polish** : confettis victoire, sons, vibrations, plein écran, a11y,
    onboarding.
11. **Tests E2E + Lighthouse CI**.
12. **CI/CD** : brancher les reusable workflows, déploiement GitHub Pages,
    vérifier l'install sur Android et iOS.

---

## 14. Critères d'acceptation finaux

- ✅ `npm run build` + `npm run preview` → app fonctionnelle, score d'une
  partie de 3 joueurs reproductible étape par étape.
- ✅ `npm run test` → 100 % vert, couverture `molkky/` > 95 %.
- ✅ `npm run test:e2e` → tag `@critical` au vert sur Chromium.
- ✅ Lighthouse PWA 100, A11y ≥ 95, Perf ≥ 90 (mobile).
- ✅ App installable sur Android Chrome **et** iOS Safari (ajouter à
  l'écran d'accueil).
- ✅ Hors-ligne complet dès la 2ᵉ visite (cache Workbox).
- ✅ Données persistantes après refresh / fermeture du navigateur.
- ✅ Animations Rive jouent OU les fallbacks SVG s'affichent — jamais de 404
  réseau, jamais de placeholder cassé.
- ✅ FR par défaut, switch EN sans rechargement.
- ✅ Thème clair / sombre + suivi système, anti-FOUC.

---

## 15. Hors périmètre (à NE PAS implémenter)

- Authentification, comptes utilisateur, backend (sauf P2 Supabase optionnel).
- Notifications push.
- Achats in-app, publicités.
- Multijoueur en temps réel (sync entre appareils).
- Reconnaissance d'image des quilles tombées (caméra) — trop complexe pour le
  MVP, peut-être en P3.

---

## 16. Ressources

- Règles officielles : <https://molkky.com>
- Concurrents à étudier (UX, captures d'écran) :
  - <https://play.google.com/store/apps/details?id=com.tacticgames.molkkyscoretracker>
  - <https://play.google.com/store/apps/details?id=io.github.vinceglb.molkky>
- Squelette PWA famille : `C:\Src\GithubMister\miss-badminton`
- Configs partagées : `C:\Src\GithubMister\dev-pwa-config\README.md`
- Runtime Rive : <https://rive.app/community/runtimes/react/>
