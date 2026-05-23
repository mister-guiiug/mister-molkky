import { useCallback } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { FeedbackEvent } from '../../store/useMatchStore';
import { playSound, type SoundEvent } from '../../sounds';

const VIBRATION_PATTERNS: Record<FeedbackEvent, number | number[]> = {
  throw: 12,
  overshoot: [30, 40, 30],
  elimination: [60, 50, 60, 50, 60],
  victory: [40, 30, 40, 30, 80],
};

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
 * Direct fire-and-forget sound trigger for UI affordances that don't fit
 * a FeedbackEvent (pin tap on/off, miss button without recording, etc.).
 */
export function usePlaySound(): (sound: SoundEvent) => void {
  const sounds = useSettingsStore(s => s.sounds);
  return useCallback(
    (sound: SoundEvent) => {
      if (!sounds) return;
      try {
        playSound(sound);
      } catch {
        /* ignore */
      }
    },
    [sounds]
  );
}
