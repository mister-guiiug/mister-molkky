import { registerSW } from 'virtual:pwa-register';

const UPDATE_BANNER_ID = 'sw-update-banner';

let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | undefined;

function showUpdateBanner(): void {
  if (document.getElementById(UPDATE_BANNER_ID)) return;

  const bar = document.createElement('div');
  bar.id = UPDATE_BANNER_ID;
  bar.className = 'sw-update-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `
    <p class="sw-update-banner__text">Une nouvelle version est disponible.</p>
    <button type="button" class="sw-update-banner__btn">Mettre à jour</button>
  `;
  document.body.appendChild(bar);

  bar
    .querySelector<HTMLButtonElement>('.sw-update-banner__btn')
    ?.addEventListener('click', () => {
      updateSWFn?.(true);
    });
}

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then(registrations => {
          registrations.forEach(r => r.unregister());
        })
        .catch(() => {});
    }
    return;
  }

  updateSWFn = registerSW({
    onNeedRefresh() {
      showUpdateBanner();
    },
    onOfflineReady() {},
  });
}

/**
 * Race a promise against a timeout. We use this when wiping SW + caches
 * because on some iOS PWA installs those calls can hang forever, and
 * the user just wants to see the page reload.
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | undefined> {
  return Promise.race([
    promise,
    new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), ms)),
  ]);
}

/**
 * Nuclear refresh: unregister every service worker, wipe every Cache
 * Storage entry, then reload with a cache-busting query string.
 *
 * We DON'T try the soft "activate waiting worker" path first because in
 * practice there is rarely a waiting SW when the user manually taps
 * "Force update" — and vite-plugin-pwa's `updateSW(true)` silently
 * no-ops in that case on some builds, leaving the user staring at a
 * button that does nothing (the reported symptom on mobile).
 *
 * IndexedDB and localStorage are intentionally left alone so the user
 * keeps their players, history, settings and templates.
 *
 * Mobile-specific notes:
 * - On iOS Safari standalone (PWA installed to home screen), the
 *   `serviceWorker.getRegistrations()` or `caches.keys()` calls can
 *   hang for several seconds. We cap the wait at 600 ms — long enough
 *   to land the cleanup on a healthy connection, short enough that the
 *   button never feels dead.
 * - Some Android Chrome webviews ignore `location.href = ...` when
 *   fired from an async continuation (the user-gesture token has
 *   expired). We try `assign` → `href` → `replace` → `reload` in
 *   sequence, and schedule an unconditional `reload()` fallback so
 *   *something* always happens within ~1.5 s of the tap.
 */
export async function forceAppUpdate(): Promise<void> {
  const target = (() => {
    const base = import.meta.env.BASE_URL || '/';
    const url = new URL(base, window.location.origin);
    url.searchParams.set('_t', Date.now().toString(36));
    return url.toString();
  })();

  // Unconditional safety net: if EVERY navigation strategy below is
  // silently dropped (seen on a couple of locked-down corporate
  // webviews), the page still reloads in ~1.5 s — far better than a
  // dead button.
  const safetyTimer = window.setTimeout(() => {
    try {
      window.location.reload();
    } catch {
      /* truly nothing left to try */
    }
  }, 1500);

  const cleanup = (async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(reg => reg.unregister().catch(() => false))
        );
      } catch {
        /* ignore — proceed to cache wipe */
      }
    }
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k).catch(() => false)));
      } catch {
        /* ignore — proceed to reload */
      }
    }
  })();

  // Race cleanup against a short cap so the button never feels stuck.
  // 600 ms is enough for a healthy SW + cache cleanup on mobile while
  // still feeling responsive if iOS Safari's APIs hang.
  await withTimeout(cleanup, 600);

  // Try every navigation strategy in order. Whichever the runtime
  // honours first wins — the rest are no-ops (we'll already have
  // unloaded).
  const navigate = () => {
    try {
      window.location.assign(target);
      return true;
    } catch {
      /* try next */
    }
    try {
      window.location.href = target;
      return true;
    } catch {
      /* try next */
    }
    try {
      window.location.replace(target);
      return true;
    } catch {
      /* try next */
    }
    try {
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  };

  const navigated = navigate();
  // If the synchronous navigation attempt didn't throw, the safety
  // timer is no longer needed (page is unloading). If it did throw,
  // the safety timer is the last line of defence.
  if (navigated) {
    window.clearTimeout(safetyTimer);
  }

  // Belt-and-braces: schedule a second attempt 150 ms later in case
  // the first was queued behind a still-pending microtask flush
  // (observed on iOS 17 PWA).
  setTimeout(() => {
    try {
      window.location.replace(target);
    } catch {
      try {
        window.location.reload();
      } catch {
        /* give up — safetyTimer (if still armed) will catch this */
      }
    }
  }, 150);
}
