<div align="center">

# 🎯 Mister Mölkky

**Compteur de scores PWA pour vos parties de Mölkky** — offline-first, multi-device, sans pub, sans tracking.

[![CI](https://github.com/mister-guiiug/mister-molkky/actions/workflows/ci.yml/badge.svg)](https://github.com/mister-guiiug/mister-molkky/actions/workflows/ci.yml)
[![Deploy](https://github.com/mister-guiiug/mister-molkky/actions/workflows/deploy.yml/badge.svg)](https://github.com/mister-guiiug/mister-molkky/actions/workflows/deploy.yml)
[![Lighthouse](https://github.com/mister-guiiug/mister-molkky/actions/workflows/lighthouse.yml/badge.svg)](https://github.com/mister-guiiug/mister-molkky/actions/workflows/lighthouse.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/mister-guiiug/mister-molkky)](https://github.com/mister-guiiug/mister-molkky/commits/main)
[![Made with React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)](https://vite.dev/)
[![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8?logo=pwa)](https://web.dev/progressive-web-apps/)

### 🚀 [**Tester la démo en ligne →**](https://mister-guiiug.github.io/mister-molkky/)

</div>

---

## ✨ Pourquoi Mister Mölkky ?

Parce que compter les scores au Mölkky sur papier finit toujours mal après le 4ᵉ tour. Mister Mölkky vous donne :

- **🎯 Saisie en 2 taps** : tapez sur les quilles tombées, validez. Le score est calculé tout seul (overshoot → 25, victoire pile à 50, élimination après 3 ratés).
- **📱 100 % offline** : installable comme une app, fonctionne sans internet une fois ouverte la première fois.
- **🌍 Multi-device en temps réel** : un téléphone hôte saisit, les autres suivent via un QR code ou un code à 6 caractères.
- **📊 Stats par joueur** : taux de victoire, précision, séries, achievements, comparatifs tête-à-tête, tendance temporelle.
- **🌑 Dark mode** + mode extérieur (gros boutons) + mode daltonien.
- **🔊 Sons + haptique gradé** + annonceur vocal (TTS) optionnel pour le mains-libres en extérieur.

---

## 🎮 Les modes de jeu

| Mode              | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| **Classique**     | Règle FIM officielle : 0 → 50 pile pour gagner                           |
| **Inversée**      | 50 → 0 pile pour gagner, overshoot = +5                                  |
| **Libre**         | Pas de retour à 25 sur dépassement, passe juste au tour suivant          |
| **Équipes**       | Duo ou trio, score partagé par équipe, rotation auto entre membres       |
| **Pratique solo** | Vise une quille spécifique tour après tour, stats de précision par cible |

Sanction configurable après X ratés : **élimination** (officiel), **remise à zéro** (kids-friendly), ou **aucune**.

---

## 🌟 Features

<details>
<summary><strong>🎯 Avant la partie</strong></summary>

- Roster de joueurs persistant avec avatars + couleurs
- Templates de règles sauvegardables (relancer en 1 tap)
- Joueurs invités one-shot (pas sauvés dans le roster)
- Mode équipes (duo/trio) avec composition auto
- 3 variantes de règles + sanction-après-ratés configurable
- Handicap par joueur (départ avantagé)
- Mélange de l'ordre de passage (bouton "Aléatoire")
- Pronostics pré-match : qui prédit le gagnant ?

</details>

<details>
<summary><strong>🎲 Pendant la partie</strong></summary>

- Saisie pin-par-pin via PinsBoard HTML/CSS Grid (CSS-only, marche sur tout)
- Coach in-match : quille / combo optimal pour gagner pile
- Call-your-shot : annonce la quille avant le tir, badge ✓/✗ après
- Highlights : marque les moments forts d'une étoile
- Chrono live (mm:ss / hh:mm)
- Mode outdoor (gros boutons + contraste poussé)
- Mode daltonien (symboles en plus des couleurs)
- Photo de la situation (caméra native pour les litiges)
- Annonceur vocal (TTS) hands-free
- Forfait individuel d'un joueur (les autres continuent)
- Swipe-down sur le scoreboard → rouvre le throws log
- Undo + édition rétroactive d'un lancer
- Toast d'élimination + confetti à la victoire

</details>

<details>
<summary><strong>📡 Mode direct (multi-device)</strong></summary>

- L'hôte génère un code à 6 caractères + un QR code
- Les viewers rejoignent via `/rejoindre` ou en scannant le QR
- Sync temps réel via Supabase Realtime (WebSocket)
- Auto-reconnexion en cas de drop réseau (jusqu'à 5 tentatives)
- Notifications browser : lancer / élimination / victoire
- Voir [`docs/live-supabase.md`](./docs/live-supabase.md) pour activer Supabase

</details>

<details>
<summary><strong>📊 Après la partie</strong></summary>

- Historique des parties avec filtres (variante, taille, durée, recherche par nom)
- **Replay animé** : scrubable, play/pause, frame-by-frame
- Carte résultat partageable en image (Web Share API → Insta / WhatsApp / etc.)
- Stats par joueur : matches, victoires, taux, podiums, précision, séries
- Comparateur tête-à-tête entre deux joueurs
- 6 achievements (premier 50, triplé, partie parfaite, vétéran, etc.)
- Sparkline du score in-match + tendance taux victoire sur les N dernières parties

</details>

<details>
<summary><strong>☁️ Sync cloud multi-device (opt-in)</strong></summary>

- Auth anonyme Supabase (pas de compte à créer)
- Push / pull manuel d'un blob JSON (roster, historique, templates, paramètres)
- Last-write-wins, conflit minimal
- Voir [`docs/cloud-sync.md`](./docs/cloud-sync.md) pour le SQL à appliquer

</details>

---

## 🚀 Quickstart

### En tant qu'utilisateur

Ouvrez la démo : **[mister-guiiug.github.io/mister-molkky](https://mister-guiiug.github.io/mister-molkky/)**

Sur mobile, le navigateur proposera d'installer l'app sur l'écran d'accueil. Elle fonctionne ensuite 100 % offline.

### En tant que développeur

```bash
git clone https://github.com/mister-guiiug/mister-molkky.git
cd mister-molkky
npm install
npm run dev          # vite dev server, http://localhost:5173
npm run test         # vitest --run
npm run build        # tsc -b && vite build
npm run lint
```

Pour activer le mode direct + cloud sync, créez un projet Supabase et exposez les variables d'environnement :

```bash
# .env.local
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

Puis appliquez les migrations SQL dans [`docs/live-supabase.md`](./docs/live-supabase.md) et [`docs/cloud-sync.md`](./docs/cloud-sync.md).

---

## 🧱 Stack

| Catégorie      | Technos                                                   |
| -------------- | --------------------------------------------------------- |
| **Framework**  | Vite 7 · React 19 · TypeScript strict                     |
| **State**      | Zustand 5 + persist middleware + IndexedDB pour les blobs |
| **Validation** | Zod 3 (branded types : `PlayerId`, `MatchId`)             |
| **Styling**    | Tailwind CSS 4 + CSS variables pour le theming            |
| **Icons**      | lucide-react (sized + wrapped centralement)               |
| **PWA**        | vite-plugin-pwa (Workbox precache, prompt registration)   |
| **Routing**    | React Router 7 (BrowserRouter + 404.html SPA fallback)    |
| **Live**       | Supabase Realtime (WebSocket CDC) + Auth anonyme          |
| **Audio**      | Web Audio API (synth offline) + Web Speech API (TTS)      |
| **Caméra**     | `<input capture="environment">` (native)                  |
| **Partage**    | Canvas → Web Share API (avec fallback download)           |
| **Tests**      | Vitest + jsdom + Testing Library                          |
| **CI**         | GitHub Actions (CI + Deploy GH Pages + Lighthouse)        |

---

## 📐 Architecture

```
src/
├── molkky/              # Domain pur (TypeScript, zéro React) — rules, ranking, stats, achievements
├── schemas.ts           # Zod schemas pour Player, MatchConfig, Throw, etc.
├── store/               # 5 stores Zustand (match, players, settings, templates, live, sync)
├── live/                # Supabase Realtime + notifications browser
├── react/
│   ├── components/      # Composants partagés (PinsBoard, ScoreTicker, Modal, …)
│   └── views/           # 8 vues (Home, Match, History, Stats, Players, Settings, JoinLive, Spectator, Practice)
├── i18n/                # FR + EN (templates literals → MessageKey union TS-safe)
├── tts.ts               # Voice announcer (Web Speech API)
├── shareCard.ts         # Canvas → PNG export
├── cloudSync.ts         # Supabase Auth + sync blob
└── sounds.ts            # Web Audio API synth (sans assets audio)
```

**Principe directeur** : le moteur de règles dans `src/molkky/` est 100 % pur — zéro dépendance React, zéro state, zéro I/O. Le store recompose tout l'état dérivé (scores, classement, joueur courant) à partir de la seule liste ordonnée de lancers. Conséquences :

- L'undo = drop le dernier lancer + recompute
- L'édition rétroactive = remplace un lancer + recompute
- Les tests sont triviaux : `replayThrows(playerIds, throws, settings)` → `MatchOutcome`

---

## 🛣️ Roadmap & inspirations

- Le brief de conception complet (objectif produit, design system, règles de scoring, modèle de données, animations Rive, critères d'acceptation) est dans **[`PROMPT.md`](./PROMPT.md)**.
- Documentation Supabase : [`docs/live-supabase.md`](./docs/live-supabase.md), [`docs/cloud-sync.md`](./docs/cloud-sync.md)
- Documentation animations Rive : [`docs/rive-pins.md`](./docs/rive-pins.md)
- Règles officielles : [molkky.com](https://molkky.com) (FIM)
- Apps inspirantes : [Mölkky® Game Tracker](https://play.google.com/store/apps/details?id=com.tacticgames.molkkyscoretracker) · [Mölkky Champion](https://play.google.com/store/apps/details?id=io.github.vinceglb.molkky)

---

## 👨‍👩‍👧 Famille `mister-guiiug`

| Projet                                | Rôle                                                              |
| ------------------------------------- | ----------------------------------------------------------------- |
| [`dev-wpa-config`](../dev-wpa-config) | Configs partagées (ESLint, Prettier, TS, Vitest, Tailwind preset) |
| [`miss-badminton`](../miss-badminton) | Squelette de référence pour les PWA `mister-*` / `miss-*`         |
| [`mister-molkky`](.)                  | **Ce projet**                                                     |

---

## ☕ Soutenir

Si l'app vous a évité une dispute "tu avais marqué combien déjà ?" pendant un BBQ, vous pouvez offrir un café à l'auteur : **[buymeacoffee.com/guiiug](https://buymeacoffee.com/guiiug)** ☕

## 📄 Licence

[MIT](./LICENSE) — fork, modifie, redistribue, héberge où tu veux. Aucun warranty, aucune obligation.
