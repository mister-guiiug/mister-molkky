import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { messages, type Locale, type Messages } from './messages';
import { I18nContext, type I18nContextValue } from './context';
import { useSettingsStore } from '../store/useSettingsStore';

function detectInitialLocale(stored: Locale | null): Locale {
  if (stored === 'fr' || stored === 'en') return stored;
  if (typeof window === 'undefined') return 'fr';
  const nav = window.navigator?.language?.slice(0, 2).toLowerCase();
  return nav === 'en' ? 'en' : 'fr';
}

function resolvePath(obj: Messages, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (
      acc &&
      typeof acc === 'object' &&
      key in (acc as Record<string, unknown>)
    ) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(params[key] ?? `{${key}}`)
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const storedLocale = useSettingsStore(s => s.locale);
  const setStoredLocale = useSettingsStore(s => s.setLocale);
  const [locale, setLocaleState] = useState<Locale>(() =>
    detectInitialLocale(storedLocale)
  );

  useEffect(() => {
    setLocaleState(storedLocale);
  }, [storedLocale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      setStoredLocale(next);
    },
    [setStoredLocale]
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const m = messages[locale];
    const t: I18nContextValue['t'] = (path, params) => {
      const resolved = resolvePath(m, path);
      if (typeof resolved !== 'string') return path;
      return interpolate(resolved, params);
    };
    return { locale, setLocale, t, m };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
