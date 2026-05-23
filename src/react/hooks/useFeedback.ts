import { useCallback } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';
import type { FeedbackEvent } from '../../store/useMatchStore';

const PATTERNS: Record<FeedbackEvent, number | number[]> = {
  throw: 12,
  overshoot: [30, 40, 30],
  elimination: [60, 50, 60, 50, 60],
  victory: [40, 30, 40, 30, 80],
};

export function useFeedback(): (event: FeedbackEvent) => void {
  const vibrations = useSettingsStore(s => s.vibrations);
  return useCallback(
    (event: FeedbackEvent) => {
      if (!vibrations) return;
      if (typeof navigator === 'undefined' || !navigator.vibrate) return;
      try {
        navigator.vibrate(PATTERNS[event] ?? 10);
      } catch {
        /* ignore */
      }
    },
    [vibrations]
  );
}
