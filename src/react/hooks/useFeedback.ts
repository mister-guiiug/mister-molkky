import {
  useFeedback as useFeedbackDuSocle,
  type FeedbackSpec,
} from '@mister-guiiug/dev-pwa-config/react/use-feedback';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { FeedbackEvent } from '../../store/useMatchStore';
import { SOUNDS, type SoundEvent } from '../../sounds';

/**
 * Retour sensoriel d'un lancer validé : un son et une vibration, par
 * événement du match.
 *
 * LA MÉCANIQUE EST AU SOCLE (`react/use-feedback`, `haptics`, `audio`) — et
 * elle en a été PROMUE : les motifs `confirm` / `warning` / `error` /
 * `victory` de `HAPTIC_PATTERNS` sont, à la milliseconde, ceux que ce fichier
 * portait (18 ; 40-50-40-50-40 ; 70-60-70-60-90 ; 50-40-50-40-80-40-140),
 * réglés sur Android Chrome. La durée et la cadence télégraphient
 * l'importance de l'événement sans regarder l'écran : un tick court pour un
 * lancer, trois pulsations moyennes pour un dépassement (« oups »), quatre
 * fortes pour une élimination, une escalade finie par une longue pour la
 * victoire. iOS ignore l'API Vibration ; le socle le vérifie avant d'appeler.
 *
 * Ce qui reste ici, c'est ce que le socle ne peut pas savoir : QUELS
 * événements, et où l'app lit ses réglages « Sons » et « Vibrations ».
 */
const EVENEMENTS_DU_MATCH = {
  throw: { sound: SOUNDS['throw-validate'], vibration: 'confirm' },
  overshoot: { sound: SOUNDS.overshoot, vibration: 'warning' },
  elimination: { sound: SOUNDS.elimination, vibration: 'error' },
  victory: { sound: SOUNDS.victory, vibration: 'victory' },
} as const satisfies Record<FeedbackEvent, FeedbackSpec>;

export function useFeedback(): (event: FeedbackEvent) => void {
  const vibrations = useSettingsStore(s => s.vibrations);
  const sounds = useSettingsStore(s => s.sounds);
  return useFeedbackDuSocle<FeedbackEvent>(EVENEMENTS_DU_MATCH, {
    sound: sounds,
    haptic: vibrations,
  });
}

/**
 * Son direct, et pichenette au doigt, pour les affordances qui ne sont pas
 * un événement du match : poser ou relever une quille sur le plateau.
 *
 * SEULES LES QUILLES VIBRENT, et plus légèrement (`tap`, 8 ms) que n'importe
 * quel événement du match (`confirm`, 18 ms) : sans regarder, on distingue
 * « j'ai touché une quille » de « j'ai validé un lancer ». Les autres sons
 * passent tels quels, sans vibration, comme avant.
 */
const EVENEMENTS_DU_PLATEAU = {
  'pin-tap': { sound: SOUNDS['pin-tap'], vibration: 'tap' },
  'pin-untap': { sound: SOUNDS['pin-untap'], vibration: 'tap' },
  'throw-validate': { sound: SOUNDS['throw-validate'] },
  miss: { sound: SOUNDS.miss },
  overshoot: { sound: SOUNDS.overshoot },
  elimination: { sound: SOUNDS.elimination },
  victory: { sound: SOUNDS.victory },
} as const satisfies Record<SoundEvent, FeedbackSpec>;

export function usePlaySound(): (sound: SoundEvent) => void {
  const sounds = useSettingsStore(s => s.sounds);
  const vibrations = useSettingsStore(s => s.vibrations);
  return useFeedbackDuSocle<SoundEvent>(EVENEMENTS_DU_PLATEAU, {
    sound: sounds,
    haptic: vibrations,
  });
}
