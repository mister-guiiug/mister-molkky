/**
 * Safe storage factory used by Zustand `persist`. Falls back to an in-memory
 * Map when `localStorage` isn't available (older Safari Private Mode,
 * test environments where the global isn't ready, etc.). This keeps tests
 * deterministic and prevents the middleware from crashing on `setItem`.
 *
 * CE FICHIER N'EST PAS UNE SAUVEGARDE. Le relevé d'adoption le compte face au
 * module `backup` du socle (export/restauration d'un magasin en fichier JSON)
 * parce qu'il guette un fichier nommé `storage.ts` — un nom trop générique, et
 * la table des équivalences le documente déjà comme tel. Ici il n'y a ni
 * export, ni restauration, ni format de fichier : un ADAPTATEUR conforme à
 * l'interface `Storage`, avec repli mémoire, que `zustand/persist` consomme.
 * Ne pas lire ce doublon comme une dette de sauvegarde.
 */

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

let memoryStorageSingleton: Storage | null = null;

export function safeLocalStorage(): Storage {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      const ls = (globalThis as { localStorage?: Storage }).localStorage;
      if (ls && typeof ls.setItem === 'function') return ls;
    }
  } catch {
    /* SecurityError in Safari private mode */
  }
  if (!memoryStorageSingleton) memoryStorageSingleton = makeMemoryStorage();
  return memoryStorageSingleton;
}
