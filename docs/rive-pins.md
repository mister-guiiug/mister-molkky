# Rive spec — `pins.riv`

The state machine `Throw` drives the 12-pin board animation. Designer's
contract:

## Inputs

| Name          | Type    | Notes                                       |
| ------------- | ------- | ------------------------------------------- |
| `pin1Down`    | bool    | `true` ⇒ pin 1 lies flat                    |
| …             | bool    | one input per pin (1..12)                   |
| `pin12Down`   | bool    | idem                                        |
| `playerColor` | number  | 0..15, indexes the team palette (see below) |
| `reset`       | trigger | redresses all pins                          |
| `throw`       | trigger | plays the "stick lands" cinematic           |

## Player colour palette

The runtime maps `playerColor` to one of 16 brand colours
(`src/store/usePlayersStore.ts:DEFAULT_PALETTE`). The artboard should
expose a single fill (`Pin / Ring`) that is keyframed to the palette via
a Color Modifier.

## Layout

The board is 256 × 256, viewing the pin field from above. Positions match
`src/molkky/pins-layout.ts:INITIAL_LAYOUT` (a 4 × 4 grid, (0,0) bottom-left).

## Other artboards

| Artboard      | SM      | Trigger          |
| ------------- | ------- | ---------------- |
| `ScoreTicker` | `Pop`   | `delta`, `play`  |
| `Victory`     | `Cheer` | `playerColor`    |
| `Elim`        | `Out`   | `play`           |
| `Idle`        | `Idle`  | (none, autoplay) |
