import { createI18n } from '@mister-guiiug/dev-pwa-config/react/i18n';
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

/** Clé du blob des réglages, où la langue vivait jusqu'ici. */
const SETTINGS_STORAGE_KEY = 'mm_settings';

/**
 * La langue, quelle que soit l'enveloppe qui l'entoure.
 *
 * TROIS FORMES COEXISTENT sur les appareils, et c'est la conséquence directe
 * du versionnage du magasin : `{ state, version }` est ce qu'écrivait
 * `zustand/persist` ; `{ v, data }` est l'enveloppe du magasin versionné du
 * socle, posée dès la première lecture qui suit la mise à jour ; l'objet nu
 * couvre le reste. Ne lire que la première — ce que faisait ce fichier —
 * remettrait en français, une seule fois et sans erreur, l'utilisateur qui
 * avait choisi l'anglais et qui n'a pas rouvert l'app depuis longtemps.
 */
function readStoredLocale(parsed: unknown): unknown {
  if (parsed === null || typeof parsed !== 'object') return undefined;
  const envelope = parsed as {
    state?: { locale?: unknown };
    data?: { locale?: unknown };
    locale?: unknown;
  };
  return envelope.state?.locale ?? envelope.data?.locale ?? envelope.locale;
}

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
    const stored = readStoredLocale(JSON.parse(raw));
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
