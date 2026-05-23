import { useRef, type TouchEvent } from 'react';

interface UseSwipeDownOptions {
  /** Pixel distance the finger must travel down before firing. */
  threshold?: number;
  /** Max time (ms) between touchstart and touchend for the gesture to count. */
  maxDuration?: number;
  /** Called once when the gesture is detected. */
  onSwipeDown: () => void;
}

interface SwipeDownHandlers {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
}

/**
 * Detects a quick downward swipe. We use it on the in-match scoreboard
 * area as a shortcut to reopen the throws log so a long-press +
 * "modifier ce lancer" round-trip becomes a one-finger gesture.
 *
 * We intentionally only fire on touchend (not while moving) — pressing
 * the screen on the scoreboard is a frequent finger-rest gesture, and
 * we don't want a slow scroll to keep triggering the swipe.
 */
export function useSwipeDown({
  threshold = 50,
  maxDuration = 600,
  onSwipeDown,
}: UseSwipeDownOptions): SwipeDownHandlers {
  const startRef = useRef<{ y: number; x: number; t: number } | null>(null);
  const movedRef = useRef<{ dy: number; dx: number } | null>(null);

  return {
    onTouchStart: e => {
      const t = e.touches[0];
      if (!t) return;
      startRef.current = { y: t.clientY, x: t.clientX, t: Date.now() };
      movedRef.current = null;
    },
    onTouchMove: e => {
      const start = startRef.current;
      const t = e.touches[0];
      if (!start || !t) return;
      movedRef.current = {
        dy: t.clientY - start.y,
        dx: t.clientX - start.x,
      };
    },
    onTouchEnd: () => {
      const start = startRef.current;
      const moved = movedRef.current;
      startRef.current = null;
      movedRef.current = null;
      if (!start || !moved) return;
      if (Date.now() - start.t > maxDuration) return;
      // Mostly-vertical down swipe past the threshold.
      if (moved.dy < threshold) return;
      if (Math.abs(moved.dx) > Math.abs(moved.dy)) return;
      onSwipeDown();
    },
  };
}
