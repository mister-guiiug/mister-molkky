import { useCallback, useRef } from 'react';

interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

export function useLongPress(
  onLong: () => void,
  onShort?: () => void,
  delayMs = 450
): LongPressHandlers {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return {
    onPointerDown: () => {
      fired.current = false;
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLong();
      }, delayMs);
    },
    onPointerUp: () => {
      const wasLong = fired.current;
      clear();
      if (!wasLong) onShort?.();
    },
    onPointerLeave: () => {
      clear();
    },
    onPointerCancel: () => {
      clear();
    },
  };
}
