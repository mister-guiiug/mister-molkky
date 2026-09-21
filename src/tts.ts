/**
 * Voice announcer — a thin wrapper over the socle's `speech` module.
 * Used when `settings.voiceAnnouncer` is true to read out turn changes and
 * match events for hands-free outdoor play.
 *
 * WHY THIS FILE SHRANK. It used to carry its own `speak()` and `pickVoice()`.
 * Both now live in `@mister-guiiug/dev-pwa-config/speech` (6.6.0), which fixes
 * two Chrome defects this copy had, and that both cut the END of a sentence —
 * here, the player's name:
 *
 * 1. an utterance nothing references can be garbage-collected *while it is
 *    speaking*, and the sound stops dead;
 * 2. `cancel()` is asynchronous, so calling `speak()` in the same tick
 *    swallows the start — sometimes all — of the new phrase. Markedly worse
 *    on Android.
 *
 * THE VOICE PICKING CAME FROM HERE, and the socle kept it — minus the
 * fallback. This copy returned `voices[0]` when no voice matched the locale:
 * the first in the list, whatever language it speaks. That is exactly what
 * makes French come out with an English accent. The socle returns none and
 * lets the engine decide from `utterance.lang`, which it does better than an
 * arbitrary pick.
 *
 * The `rate` and `interrupt` options are gone with the local `speak()`: no
 * call site ever set either of them.
 */

import { speak } from '@mister-guiiug/dev-pwa-config/speech';
import type { Locale } from './schemas';

/**
 * Announcements end with a full stop on purpose. Without sentence-final
 * punctuation the engine applies no closing cadence and clips the last
 * syllable — and the last word here is the player's name.
 *
 * `voiceName` is the voice the user picked in Settings; empty or unknown lets
 * the socle choose. It travels explicitly, exactly like `locale`: this module
 * stays free of any store, which is what makes it testable on its own.
 */
function announce(text: string, locale: Locale, voiceName?: string): void {
  speak(`${text}.`, locale, { voiceName });
}

/** Convenience helper for the typical "À toi, Marc" announcement. */
export function announceTurn(
  playerName: string,
  locale: Locale,
  voiceName?: string
): void {
  announce(
    locale === 'fr' ? `À toi ${playerName}` : `Your turn, ${playerName}`,
    locale,
    voiceName
  );
}

/** Convenience helper for overshoot. */
export function announceOvershoot(locale: Locale, voiceName?: string): void {
  announce(locale === 'fr' ? 'Dépassement' : 'Overshoot', locale, voiceName);
}

/** Convenience helper for elimination. */
export function announceElimination(
  playerName: string,
  locale: Locale,
  voiceName?: string
): void {
  announce(
    locale === 'fr'
      ? `${playerName} est éliminé`
      : `${playerName} is eliminated`,
    locale,
    voiceName
  );
}
