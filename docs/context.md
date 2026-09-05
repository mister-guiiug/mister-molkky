# Mister Mölkky — context

A mobile-first PWA for tracking Mölkky (Finnish skittles) matches: 2–16
players, automatic scoring (overshoot → 25, three misses → elimination,
exact 50 → win), per-player stats and a full match history. Works offline.

## Why this exists

The two reference apps on the Play Store (Tactic Games' tracker and Vincent
Guillebaud's Champion) cover the basics but no Mölkky tracker bundles
_persisted players_, _animated UI_, _stats_ and _offline-first_ in a
mobile-installable package. Mister Mölkky aims for parity then differentiates
with Rive animations, per-pin heatmaps and shareable match exports.

## Tech

- Vite 7 + React 19 + TypeScript (`@mister-guiiug/dev-pwa-config`)
- Tailwind 4, Zustand 5 (`persist`), Zod 3
- vite-plugin-pwa (Workbox, prompt registration)
- @rive-app/react-canvas 4 with React/SVG fallbacks

See `PROMPT.md` for the full brief.
