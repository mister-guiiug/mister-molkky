const LOG_KEY = 'mm_error_log';
const MAX_ENTRIES = 50;

export interface ErrorEntry {
  at: number;
  message: string;
  stack?: string;
  source?: string;
  url: string;
  userAgent: string;
}

type Forwarder = (entry: ErrorEntry) => void;

let forwarder: Forwarder | null = null;

function read(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(entries: ErrorEntry[]): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* ignore quota */
  }
}

export function logError(
  entry: Omit<ErrorEntry, 'at' | 'url' | 'userAgent'>
): void {
  const full: ErrorEntry = {
    ...entry,
    at: Date.now(),
    url: typeof window === 'undefined' ? '' : window.location.href,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
  };
  const next = [...read(), full];
  persist(next);
  if (forwarder) {
    try {
      forwarder(full);
    } catch {
      /* never break the logger because the forwarder threw */
    }
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[mm-error]', full.message, full.stack ?? '');
  }
}

export function getErrorLog(): ErrorEntry[] {
  return read();
}

export function clearErrorLog(): void {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}

export function setForwarder(fn: Forwarder | null): void {
  forwarder = fn;
}

let installed = false;
export function installErrorReporter(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', e => {
    logError({
      message: e.message || 'window.onerror',
      stack: e.error?.stack,
      source: e.filename,
    });
  });
  window.addEventListener('unhandledrejection', e => {
    const reason = e.reason as unknown;
    let message = 'unhandledrejection';
    let stack: string | undefined;
    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack;
    } else if (typeof reason === 'string') {
      message = reason;
    } else {
      try {
        message = JSON.stringify(reason);
      } catch {
        /* ignore */
      }
    }
    logError({ message, stack, source: 'unhandledrejection' });
  });
}
