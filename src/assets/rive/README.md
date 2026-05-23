# Rive assets — Mister Mölkky

Drop the production `.riv` files here. They are imported via
`src/react/components/RiveScene.tsx`, which **probes** every file before
rendering — when one is missing or invalid, the React/SVG fallback is shown
instead. This means the app works without any of these files being present,
which is convenient while the designer hasn't shipped them yet.

| File              | Artboard      | State machine | Inputs                                                                                  | Used in                  |
| ----------------- | ------------- | ------------- | --------------------------------------------------------------------------------------- | ------------------------ |
| `pins.riv`        | `PinsBoard`   | `Throw`       | `pin1Down`..`pin12Down` (bool), `reset` (trigger), `playerColor` (number 0–15)          | `PinsBoardRive` overlay  |
| `score-pop.riv`   | `ScoreTicker` | `Pop`         | `delta` (number), `play` (trigger)                                                       | `ScoreTicker`            |
| `victory.riv`     | `Victory`     | `Cheer`       | `playerColor` (number)                                                                   | Victory screen           |
| `elimination.riv` | `Elim`        | `Out`         | `play` (trigger)                                                                         | Elimination banner       |
| `idle.riv`        | `Idle`        | `Idle`        | -                                                                                       | Home view hero           |

All scenes should be designed at 1× = **256 × 256** with Fit `Contain`.

> See `docs/rive-pins.md` for the per-state-machine breakdown.
