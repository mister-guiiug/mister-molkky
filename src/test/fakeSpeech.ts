/**
 * A fake Web Speech synthesis for tests, and the voice list actually measured
 * on the machine that reported the bug.
 *
 * WHY THIS IS SHARED. Two test files need it — the Settings picker and the
 * in-match announcements — and the socle's `speech` module keeps state: it
 * attaches its `voiceschanged` listener to the object it is first handed and
 * caches the voices. Each file gets its own singleton (Vitest isolates modules
 * per file), but within a file the object must never be swapped, or the
 * listener would stay on the old one and the cache would never refresh.
 */

/**
 * The real list from Firefox 156 / Windows, 21/09/2026. Worth freezing as-is:
 * **no voice carries `default: true`**, not even the system one, which is why
 * no heuristic can follow the user's choice there; and `Microsoft Hortense` —
 * the first of them, hence the one the socle picks — is precisely the voice
 * that mangles words after punctuation.
 */
export const MEASURED_VOICES = [
  'Microsoft Hortense - French (France)',
  'Microsoft Julie - French (France)',
  'Microsoft Paul - French (France)',
].map(
  name =>
    ({
      name,
      lang: 'fr-FR',
      default: false,
      localService: true,
      voiceURI: `urn:moz-tts:sapi:${name}?fr-FR`,
    }) as SpeechSynthesisVoice
);

export class FakeUtterance {
  text: string;
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

class FakeSynthesis extends EventTarget {
  voices: SpeechSynthesisVoice[] = [];
  spoken: FakeUtterance[] = [];
  speaking = false;
  pending = false;
  getVoices() {
    return this.voices;
  }
  speak(u: FakeUtterance) {
    this.spoken.push(u);
  }
  cancel() {}
}

export const fakeSynth = new FakeSynthesis();

/** Installs the fake on `globalThis`. Call once per file, in `beforeAll`. */
export function installFakeSpeech(): void {
  Object.defineProperty(globalThis, 'speechSynthesis', {
    value: fakeSynth,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    value: FakeUtterance,
    configurable: true,
  });
}

/**
 * Sets a voice list AND fires `voiceschanged` — the only way to clear the
 * socle's cache, which is exactly what a real browser does when its voices
 * load after the page.
 */
export function setVoices(voices: SpeechSynthesisVoice[]): void {
  fakeSynth.voices = voices;
  fakeSynth.dispatchEvent(new Event('voiceschanged'));
}

/** Forgets what was spoken, without touching the voice list or the listeners. */
export function clearSpoken(): void {
  fakeSynth.spoken = [];
}
