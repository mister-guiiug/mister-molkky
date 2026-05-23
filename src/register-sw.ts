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
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
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
 * A 2 s safety timeout wraps the SW + cache work: if any browser API
 * hangs (seen on iOS Safari PWA), we force the reload anyway so the
 * UX never freezes on a clickable-but-dead button.
 */
export async function forceAppUpdate(): Promise<void> {
  const unregisterAllSW = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(reg => reg.unregister().catch(() => false))
      );
    } catch {
      /* ignore — proceed to cache wipe */
    }
  };

  const wipeAllCaches = async () => {
    if (typeof caches === 'undefined') return;
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k).catch(() => false)));
    } catch {
      /* ignore — proceed to reload */
    }
  };

  await withTimeout(
    Promise.all([unregisterAllSW(), wipeAllCaches()]),
    2000
  );

  // Cache-busting query string defeats the GH Pages CDN edge cache AND
  // any HTTP cache layer that survives SW unregister on iOS.
  const url = new URL(window.location.href);
  url.searchParams.set('_t', Date.now().toString(36));

  // Some iOS PWA installs ignore replace() but honour assigning to href.
  // Fire both — whichever the runtime applies first wins.
  try {
    window.location.href = url.toString();
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    try {
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }, 100);
}
