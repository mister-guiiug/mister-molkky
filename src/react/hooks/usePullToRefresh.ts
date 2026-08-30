import { useEffect, useRef, useState } from 'react';

interface PullToRefreshOptions {
  enabled?: boolean;
  threshold?: number;
  onRefresh: () => void | Promise<void>;
}

interface PullToRefreshState {
  pulling: boolean;
  /** 0–1: how far through the threshold the user has pulled. */
  progress: number;
  refreshing: boolean;
}

/**
 * Lightweight pull-to-refresh: detects a downward touch swipe that starts
 * when the page is already scrolled to the top, surfaces a progress value
 * the caller can render as an indicator, and fires `onRefresh()` when the
 * gesture crosses the threshold.
 *
 * Scoped to a single component (the call site owns the state) so we can
 * enable it on /history and /live/:code without re-enabling the
 * native browser pull-to-refresh on the rest of the app — which would
 * accidentally reload mid-match. While enabled we also flip
 * overscroll-behavior-y to 'auto' so the browser doesn't fight us.
 */
export function usePullToRefresh({
  enabled = true,
  threshold = 64,
  onRefresh,
}: PullToRefreshOptions): PullToRefreshState {
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const distance = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overscrollBehaviorY;
    const prevBody = body.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'auto';
    body.style.overscrollBehaviorY = 'auto';

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0]?.clientY ?? null;
      distance.current = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startY.current;
      if (delta <= 0) {
        distance.current = 0;
        setPulling(false);
        setProgress(0);
        return;
      }
      // Damped pull (rubber-band feel).
      distance.current = Math.min(delta * 0.55, threshold * 1.5);
      setPulling(true);
      setProgress(Math.min(1, distance.current / threshold));
    };

    const onTouchEnd = async () => {
      const reached = distance.current >= threshold;
      startY.current = null;
      distance.current = 0;
      setPulling(false);
      setProgress(0);
      if (!reached || refreshing) return;
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      html.style.overscrollBehaviorY = prevHtml;
      body.style.overscrollBehaviorY = prevBody;
    };
  }, [enabled, threshold, onRefresh, refreshing]);

  return { pulling, progress, refreshing };
}
