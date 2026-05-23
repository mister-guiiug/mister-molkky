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
 * Try to apply a waiting service worker update (the "nice path" — same as
 * tapping the SW update banner). Returns true if a waiting worker was
 * activated. Caller should fall back to forceAppUpdate() if it returns
 * false, which means there is no pending update and the user is just
 * asking "give me the very latest version, NOW".
 */
async function tryActivateWaitingWorker(): Promise<boolean> {
  if (!updateSWFn) return false;
  try {
    await updateSWFn(true);
    return true;
  } catch {
    return false;
  }
}

/**
 * Nuclear refresh: unregister every service worker, wipe every Cache
 * Storage entry, then reload with a cache-busting query string. This
 * defeats the SW intercepting the navigation request and re-serving
 * the stale HTML — which was why the previous version of this helper
 * silently no-op'd when no waiting worker was present.
 *
 * IndexedDB and localStorage are intentionally left alone so the user
 * keeps their players, history, settings and templates.
 */
export async function forceAppUpdate(): Promise<void> {
  if (await tryActivateWaitingWorker()) return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(reg => reg.unregister().catch(() => false))
      );
    }
  } catch {
    /* ignore — proceed to cache wipe */
  }

  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key).catch(() => false)));
    }
  } catch {
    /* ignore — proceed to reload */
  }

  // Cache-busting query string makes sure the browser pulls a fresh
  // index.html from the network (relevant for the GH Pages CDN edge cache).
  const url = new URL(window.location.href);
  url.searchParams.set('_t', Date.now().toString(36));
  window.location.replace(url.toString());
}
