import { createContext } from 'react';
import type { Locale, Messages } from './messages';

type Paths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : T[K] extends object
          ? `${K}.${Paths<T[K]>}`
          : never;
    }[keyof T & string];

export type MessageKey = Paths<Messages>;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (path: MessageKey, params?: Record<string, string | number>) => string;
  m: Messages;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
