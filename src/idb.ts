const DB_NAME = 'mister-molkky';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_BLOBS = 'blobs';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV))
        db.createObjectStore(STORE_KV);
      if (!db.objectStoreNames.contains(STORE_BLOBS))
        db.createObjectStore(STORE_BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

export async function idbPutBlob(key: string, blob: Blob): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise<boolean>(resolve => {
    try {
      const req = tx(db, STORE_BLOBS, 'readwrite').put(blob, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbGetBlob(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise<Blob | undefined>(resolve => {
    try {
      const req = tx(db, STORE_BLOBS, 'readonly').get(key);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbDelBlob(key: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise<boolean>(resolve => {
    try {
      const req = tx(db, STORE_BLOBS, 'readwrite').delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Supprime la base IndexedDB de l'app (avatars, photos de situation), et
 * seulement elle : les apps de la famille ont chacune la leur sur la même
 * origine. La connexion ouverte est fermée d'abord, sinon la suppression
 * resterait bloquée jusqu'au rechargement.
 */
export async function idbEffacerTout(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  const ouverte = dbPromise ? await dbPromise : null;
  ouverte?.close();
  dbPromise = null;
  return new Promise<boolean>(resolve => {
    try {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
