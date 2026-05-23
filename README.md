# Mister Mölkky

PWA de gestion de parties de **Mölkky** (jeu de quilles finlandais) : comptage
automatique des scores, animations Rive, statistiques par joueur, historique
des parties, 100 % offline.

> 🚧 **Projet en amorçage.** Le code n'est pas encore implémenté.
> Le brief de développement complet est dans **[`PROMPT.md`](./PROMPT.md)** :
> stack, arborescence, règles du Mölkky, modèle de données, animations Rive,
> roadmap, critères d'acceptation.

## Démarrage (une fois le scaffolding terminé)

```bash
npm install
npm run dev
```

## Stack cible

- Vite 7 + React 19 + TypeScript ~6.0.2
- Tailwind CSS 4 (preset famille `@mister-guiiug/dev-wpa-config`)
- Zustand 5 + persist + IndexedDB
- vite-plugin-pwa (Workbox, offline-first)
- @rive-app/react-canvas pour les animations
- Vitest + Playwright + Lighthouse CI

## Famille `mister-guiiug`

| Projet                                | Rôle                                |
| ------------------------------------- | ----------------------------------- |
| [`dev-wpa-config`](../dev-wpa-config) | Configs partagées (ESLint, TS, …)   |
| [`miss-badminton`](../miss-badminton) | **Squelette de référence** pour PWA |
| [`mister-molkky`](.)                  | Ce projet                           |

## Inspiration produit

- [Mölkky® Game Tracker (Tactic Games)](https://play.google.com/store/apps/details?id=com.tacticgames.molkkyscoretracker)
- [Mölkky Champion: Score & Stats (Vincent Guillebaud)](https://play.google.com/store/apps/details?id=io.github.vinceglb.molkky)
- Règles officielles : [molkky.com](https://molkky.com)

## Licence

MIT — voir [`LICENSE`](./LICENSE).
