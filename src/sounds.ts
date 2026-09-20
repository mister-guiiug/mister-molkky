import type {
  ToneSpec,
  TonePresetName,
} from '@mister-guiiug/dev-pwa-config/audio';

/**
 * Les sons du jeu, synthétisés — aucun asset audio à télécharger, la PWA
 * reste légère et joue hors ligne.
 *
 * LE MOTEUR EST AU SOCLE. `@mister-guiiug/dev-pwa-config/audio` a été promu
 * DEPUIS ce fichier (contexte paresseux, oscillateur + enveloppe, repli
 * silencieux, `resume()` avant chaque note pour iOS) : la copie locale avait
 * la même enveloppe, note pour note. Ne reste ici que ce qui est propre à
 * Mölkky — la table des sons.
 *
 * QUATRE SONS SONT DES PRESETS DU SOCLE, À LA NOTE PRÈS : `pin-tap` est
 * `tap`, `throw-validate` est `confirm`, `elimination` est `error`,
 * `victory` est `victory`. On les nomme plutôt que de les recopier : c'est le
 * même nom que le motif de vibration, et c'est voulu. Les trois autres
 * restent écrits ici parce qu'ils diffèrent : `overshoot` a une TROISIÈME
 * note (160 Hz, dent de scie) que le preset `warning` n'a pas ; `pin-untap`
 * et `miss` n'ont pas d'équivalent.
 */
export type SoundEvent =
  | 'pin-tap'
  | 'pin-untap'
  | 'throw-validate'
  | 'miss'
  | 'overshoot'
  | 'elimination'
  | 'victory';

export const SOUNDS: Record<SoundEvent, TonePresetName | ToneSpec[]> = {
  'pin-tap': 'tap',
  'pin-untap': [{ freq: 200, duration: 0.06, type: 'triangle', volume: 0.1 }],
  'throw-validate': 'confirm',
  miss: [{ freq: 180, duration: 0.18, type: 'sawtooth', volume: 0.18 }],
  overshoot: [
    { freq: 300, duration: 0.12, type: 'square', volume: 0.18 },
    { freq: 220, duration: 0.18, type: 'square', volume: 0.18, at: 0.1 },
    { freq: 160, duration: 0.22, type: 'sawtooth', volume: 0.2, at: 0.22 },
  ],
  elimination: 'error',
  victory: 'victory',
};
