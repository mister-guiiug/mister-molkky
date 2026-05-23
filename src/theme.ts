const LS_THEME = 'mm_theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

type Listener = (resolved: ResolvedTheme) => void;
const listeners = new Set<Listener>();

export function getStoredThemePreference(): ThemePreference {
  try {
    const s = localStorage.getItem(LS_THEME);
    if (s === 'light' || s === 'dark' || s === 'system') return s;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function getResolvedTheme(): ResolvedTheme {
  const pref = getStoredThemePreference();
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#4a7c2a' : '#11140f');
  }
  listeners.forEach(l => l(theme));
}

export function applyResolvedTheme(): void {
  applyTheme(getResolvedTheme());
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(LS_THEME, pref);
  } catch {
    /* ignore */
  }
  applyResolvedTheme();
}

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function wireSystemThemeListener(): void {
  if (typeof window === 'undefined') return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (getStoredThemePreference() === 'system') {
      applyTheme(mq.matches ? 'dark' : 'light');
    }
  });
}
