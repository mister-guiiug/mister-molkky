import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from './schemas';

/**
 * What this file owns, and what it does not.
 *
 * The Web Speech plumbing — keeping a reference so the utterance survives the
 * garbage collector, never calling `speak()` in the same tick as `cancel()`,
 * picking a voice for the locale — lives in the socle
 * (`@mister-guiiug/dev-pwa-config/speech`) and is tested there, nine tests
 * with counter-proofs. Re-testing it here would test the mock.
 *
 * What belongs to molkky is the WORDING: which sentence for which event, in
 * which language, and the full stop that closes it. That last one is not
 * cosmetic — without sentence-final punctuation the engine applies no closing
 * cadence and clips the last syllable, and the last syllable here is the
 * player's name.
 */

const { speak } = vi.hoisted(() => ({ speak: vi.fn() }));
vi.mock('@mister-guiiug/dev-pwa-config/speech', () => ({ speak }));

const { announceElimination, announceOvershoot, announceTurn } =
  await import('./tts');

/** The text handed to the socle on the last call. */
const dernierTexte = () => speak.mock.calls.at(-1)?.[0] as string;
/** The locale handed to the socle on the last call. */
const derniereLocale = () => speak.mock.calls.at(-1)?.[1] as Locale;

beforeEach(() => {
  speak.mockClear();
});

describe('voice announcer', () => {
  it('announces the turn in French', () => {
    announceTurn('Marc', 'fr');
    expect(dernierTexte()).toBe('À toi Marc.');
    expect(derniereLocale()).toBe('fr');
  });

  it('announces the turn in English', () => {
    announceTurn('Marc', 'en');
    expect(dernierTexte()).toBe('Your turn, Marc.');
    expect(derniereLocale()).toBe('en');
  });

  it('announces an overshoot in both languages', () => {
    announceOvershoot('fr');
    expect(dernierTexte()).toBe('Dépassement.');
    announceOvershoot('en');
    expect(dernierTexte()).toBe('Overshoot.');
  });

  it('announces an elimination in both languages', () => {
    announceElimination('Marc', 'fr');
    expect(dernierTexte()).toBe('Marc est éliminé.');
    announceElimination('Marc', 'en');
    expect(dernierTexte()).toBe('Marc is eliminated.');
  });

  /**
   * THE GUARD THAT MATTERS. Every announcement must close with a full stop,
   * whichever helper and whichever language — otherwise the engine clips the
   * last syllable. Written as a rule over all six combinations rather than as
   * six frozen strings, so a new helper or a reworded sentence stays covered.
   */
  it('always ends with a full stop, whatever the helper and the language', () => {
    const locales: Locale[] = ['fr', 'en'];
    const appels: Array<[string, (l: Locale) => void]> = [
      ['announceTurn', l => announceTurn('Marc', l)],
      ['announceOvershoot', l => announceOvershoot(l)],
      ['announceElimination', l => announceElimination('Marc', l)],
    ];

    for (const [nom, appel] of appels) {
      for (const locale of locales) {
        appel(locale);
        expect(dernierTexte(), `${nom} en ${locale}`).toMatch(/\.$/);
        // Et jamais deux points collés, si un libellé en gagnait un.
        expect(dernierTexte(), `${nom} en ${locale}`).not.toMatch(/\.\.$/);
      }
    }
    expect(speak).toHaveBeenCalledTimes(6);
  });

  it('carries the player name through, so it is the name that is read', () => {
    announceTurn('Jean-Luc', 'fr');
    expect(dernierTexte()).toContain('Jean-Luc');
    announceElimination('Jean-Luc', 'en');
    expect(dernierTexte()).toContain('Jean-Luc');
  });

  /**
   * The locale is forwarded as-is: the socle turns `fr` into `fr-FR` and picks
   * a voice from it. Passing a BCP-47 tag from here would work too, but two
   * conversions in two places is how they drift apart.
   */
  it('forwards the locale to the socle, not a converted tag', () => {
    announceTurn('Marc', 'fr');
    expect(derniereLocale()).toBe('fr');
    expect(derniereLocale()).not.toBe('fr-FR');
  });
});
