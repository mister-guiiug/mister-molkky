/**
 * Voice announcer (Web Speech API). Pure browser, offline, no backend.
 * Used when `settings.voiceAnnouncer` is true to read out turn changes
 * and match events for hands-free outdoor play.
 *
 * We pick a voice matching the current i18n locale (fallback to the
 * platform default) so the pronunciation is right.
 */

import type { Locale } from './schemas';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let cachedVoices: SpeechSynthesisVoice[] | null = null;

/**
 * Resolve a voice for the given locale. Lazily caches the voice list
 * (some browsers populate it asynchronously, so callers should retry
 * after the `voiceschanged` event if the first call returns nothing).
 */
function pickVoice(locale: Locale): SpeechSynthesisVoice | null {
  if (!supported) return null;
  if (!cachedVoices || cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  if (cachedVoices.length === 0) return null;
  const prefix = locale === 'fr' ? 'fr' : 'en';
  return (
    cachedVoices.find(v => v.lang.toLowerCase().startsWith(prefix)) ??
    cachedVoices[0] ??
    null
  );
}

interface SpeakOptions {
  text: string;
  locale?: Locale;
  /** 0.5..2 — 1 is default platform rate. */
  rate?: number;
  /** Cancels any queued speech first (prevents overlap on rapid events). */
  interrupt?: boolean;
}

/**
 * Speak a string out loud. Silently no-ops when the browser doesn't
 * support speechSynthesis (Safari iOS standalone PWA before v17 in
 * some configurations). Keeps the rest of the app a strict superset
 * of TTS-free behaviour.
 */
export function speak({
  text,
  locale = 'fr',
  rate = 1,
  interrupt = true,
}: SpeakOptions): void {
  if (!supported || !text) return;
  if (interrupt) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* some browsers throw on cancel() in restricted contexts */
    }
  }
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(locale);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = locale === 'fr' ? 'fr-FR' : 'en-US';
  }
  utterance.rate = Math.max(0.5, Math.min(2, rate));
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    /* ignore — best-effort */
  }
}

/**
 * Convenience helper for the typical "À toi, Marc" announcement.
 */
export function announceTurn(playerName: string, locale: Locale): void {
  const text =
    locale === 'fr' ? `À toi ${playerName}` : `Your turn, ${playerName}`;
  speak({ text, locale });
}

/** Convenience helper for the score after a throw. */
export function announceScore(score: number, locale: Locale): void {
  const text = locale === 'fr' ? `${score} points` : `${score} points`;
  speak({ text, locale });
}

/** Convenience helper for overshoot. */
export function announceOvershoot(locale: Locale): void {
  speak({
    text: locale === 'fr' ? 'Dépassement' : 'Overshoot',
    locale,
  });
}

/** Convenience helper for elimination. */
export function announceElimination(playerName: string, locale: Locale): void {
  speak({
    text:
      locale === 'fr'
        ? `${playerName} est éliminé`
        : `${playerName} is eliminated`,
    locale,
  });
}
