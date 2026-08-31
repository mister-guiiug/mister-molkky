import { createI18n } from '@mister-guiiug/dev-wpa-config/react/i18n';
import { messages } from './messages';

export type { Locale, Messages } from './messages';

/**
 * Clé de persistance du choix de langue.
 *
 * PAS la clé famille `dwc_locale` (le défaut du socle). Les apps de la famille
 * partagent une origine GitHub Pages, donc un même `localStorage` : la clé par
 * défaut ferait suivre la langue d'une app à l'autre. Mölkky ne peut pas s'y
 * ranger — sa langue est une donnée SYNCHRONISÉE (`cloudSync` la pousse et la
 * tire avec le reste des réglages), et une valeur écrite par une autre app
 * remonterait dans la charge utile du prochain `push`.
 */
export const LOCALE_STORAGE_KEY = 'mm_locale';

/** Clé du blob `zustand/persist` où la langue vivait jusqu'ici. */
const SETTINGS_STORAGE_KEY = 'mm_settings';

/**
 * Reprise du choix déjà stocké, une fois.
 *
 * La langue ne vivait pas sous une clé à elle : elle était un champ du blob
 * `mm_settings`. Sans cette reprise, la première ouverture après mise à jour
 * trouverait `mm_locale` vide, retomberait sur la langue du navigateur, et
 * remettrait en français un utilisateur qui avait choisi l'anglais — sans
 * erreur, une seule fois, donc sans que personne ne le remonte.
 *
 * Appelée AVANT `createI18n` : le provider lit `mm_locale` à son montage.
 */
function adoptStoredLocale(): void {
  try {
    if (localStorage.getItem(LOCALE_STORAGE_KEY)) return;
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    const stored = (parsed as { state?: { locale?: unknown } } | null)?.state
      ?.locale;
    if (stored === 'fr' || stored === 'en') {
      localStorage.setItem(LOCALE_STORAGE_KEY, stored);
    }
  } catch {
    /* stockage indisponible ou blob illisible : la détection fera le reste */
  }
}

if (typeof window !== 'undefined') adoptStoredLocale();

export const { I18nProvider, useI18n } = createI18n({
  messages,
  locales: ['fr', 'en'],
  fallbackLocale: 'fr',
  storageKey: LOCALE_STORAGE_KEY,
});
