import { useEffect } from 'react';
import { useSettingsStore } from '../../store/useSettingsStore';

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
};

type WakeLockNav = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>;
  };
};

export function useWakeLock(active: boolean): void {
  const enabled = useSettingsStore(s => s.wakeLock);
  useEffect(() => {
    if (!active || !enabled) return;
    const nav = navigator as WakeLockNav;
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request('screen');
      } catch {
        /* user gesture missing, ignore */
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sentinel?.released) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => undefined);
      void cancelled;
    };
  }, [active, enabled]);
}
