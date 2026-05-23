import { useCallback } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { FeedbackEvent } from '../../store/useMatchStore';
import { playSound, type SoundEvent } from '../../sounds';

// Graded vibration patterns: the duration + cadence telegraph the
// importance of the event without the user having to look at the
// screen. Tuned on Android Chrome (iOS still ignores Vibration API).
//   throw       → 1 short tick     (acknowledgement)
//   overshoot   → 3 medium pulses  (oops!)
//   elimination → 4 strong pulses  (warning)
//   victory     → 5 escalating pulses ending on a long one (celebration)
const VIBRATION_PATTERNS: Record<FeedbackEvent, number | number[]> = {
  throw: 18,
  overshoot: [40, 50, 40, 50, 40],
  elimination: [70, 60, 70, 60, 90],
  victory: [50, 40, 50, 40, 80, 40, 140],
};

/**
 * Light haptic for fire-and-forget UI affordances (pin tap, etc.).
 * Distinct enough from the "throw" pattern that the user can tell a
 * single pin tap from a validated turn.
 */
const LIGHT_TAP_VIBRATION = 8;

const SOUND_FOR_FEEDBACK: Record<FeedbackEvent, SoundEvent> = {
  throw: 'throw-validate',
  overshoot: 'overshoot',
  elimination: 'elimination',
  victory: 'victory',
};

export function useFeedback(): (event: FeedbackEvent) => void {
  const vibrations = useSettingsStore(s => s.vibrations);
  const sounds = useSettingsStore(s => s.sounds);
  return useCallback(
    (event: FeedbackEvent) => {
      if (sounds) {
        try {
          playSound(SOUND_FOR_FEEDBACK[event]);
        } catch {
          /* ignore */
        }
      }
      if (vibrations && typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(VIBRATION_PATTERNS[event] ?? 10);
        } catch {
          /* ignore */
        }
      }
    },
    [vibrations, sounds]
  );
}

/**
 * Direct fire-and-forget sound + tiny haptic for UI affordances that
 * don't fit a FeedbackEvent (pin tap on/off, miss button without
 * recording, etc.). The haptic is intentionally lighter than any
 * FeedbackEvent so users can tell "I tapped a pin" from "I validated
 * a turn" without looking.
 */
export function usePlaySound(): (sound: SoundEvent) => void {
  const sounds = useSettingsStore(s => s.sounds);
  const vibrations = useSettingsStore(s => s.vibrations);
  return useCallback(
    (sound: SoundEvent) => {
      if (sounds) {
        try {
          playSound(sound);
        } catch {
          /* ignore */
        }
      }
      if (
        vibrations &&
        typeof navigator !== 'undefined' &&
        navigator.vibrate &&
        (sound === 'pin-tap' || sound === 'pin-untap')
      ) {
        try {
          navigator.vibrate(LIGHT_TAP_VIBRATION);
        } catch {
          /* ignore */
        }
      }
    },
    [sounds, vibrations]
  );
}
