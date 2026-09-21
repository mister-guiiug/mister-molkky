import { useEffect, useReducer } from 'react';
import {
  listVoices,
  onVoicesChanged,
} from '@mister-guiiug/dev-pwa-config/speech';

/**
 * Speech voices available in the UI language, so the user can pick one.
 *
 * SUBSCRIBING IS NOT OPTIONAL. `speechSynthesis.getVoices()` returns an EMPTY
 * array on its first call in most browsers — the list arrives asynchronously.
 * A component that merely read it on mount would show an empty list forever.
 * The socle clears its cache before notifying, so the callback sees the fresh
 * list.
 *
 * WE DO NOT KEEP THE LIST, WE RE-READ IT. Holding it in `useState` meant
 * writing it back from the effect — a synchronous `setState` on mount, which
 * triggers a cascading render. The effect only subscribes; the counter merely
 * asks for a re-render. Re-reading is a filter over a handful of entries, and
 * Settings is not a hot path.
 *
 * Returns an empty array where Web Speech does not exist (SSR, jsdom): callers
 * have nothing to guard.
 */
export function useVoices(locale: string): SpeechSynthesisVoice[] {
  const [, signal] = useReducer((n: number) => n + 1, 0);

  useEffect(() => onVoicesChanged(signal), []);

  return byName(listVoices(locale));
}

/**
 * One entry per NAME, since the name is both the value and the React key of
 * the dropdown: two homonyms would give two indistinguishable choices and a
 * duplicate key.
 *
 * This is NOT about Firefox's doubles — it exposes the same voice under its
 * OneCore entry and its SAPI5 "Desktop" entry, but their names DIFFER
 * ("Microsoft Hortense - French (France)" and "Microsoft Hortense Desktop -
 * French"), so both stay on offer. That is correct: nothing guarantees they
 * behave alike.
 */
function byName(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.filter(
    (voice, i) => voices.findIndex(other => other.name === voice.name) === i
  );
}
