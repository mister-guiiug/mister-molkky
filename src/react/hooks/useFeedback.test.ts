import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useFeedback, usePlaySound } from './useFeedback';

/**
 * CE QUE CES TESTS TIENNENT : ce que Mölkky fait entendre et sentir, pas la
 * mécanique du socle (garde `navigator.vibrate`, contexte audio paresseux,
 * enveloppe — éprouvés là-bas). Trois choses ont été promues au socle telles
 * quelles et doivent le rester ici : les motifs de vibration mesurés dans
 * cette app, la troisième note de « overshoot » (absente du preset
 * `warning`), et la pichenette des quilles, plus légère qu'un lancer.
 */

/** Chaque oscillateur créé, dans l'ordre : sa fréquence et sa forme d'onde. */
const notes: Array<{ freq: number; type: string }> = [];

/** Un contexte audio qui note les oscillateurs au lieu de sonner. */
class FauxAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};

  createOscillator() {
    const osc = {
      type: 'sine',
      frequency: {
        setValueAtTime: (freq: number) => {
          notes.push({ freq, type: osc.type });
        },
      },
      connect: (noeud: unknown) => noeud,
      start: () => undefined,
      stop: () => undefined,
    };
    return osc;
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: (noeud: unknown) => noeud,
    };
  }
}

const vibrate = vi.fn(() => true);

beforeAll(() => {
  // Le socle crée son contexte au premier son et le garde pour la session :
  // le faux doit être en place avant, et y rester.
  vi.stubGlobal('AudioContext', FauxAudioContext);
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
    writable: true,
  });
});

beforeEach(() => {
  notes.length = 0;
  vibrate.mockClear();
  useSettingsStore.getState().reset();
});

afterEach(() => {
  useSettingsStore.getState().reset();
});

describe("le retour d'un lancer", () => {
  it('fait sentir et entendre un dépassement comme avant : trois pulsations moyennes, trois notes', () => {
    const { result } = renderHook(() => useFeedback());

    result.current('overshoot');

    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith([40, 50, 40, 50, 40]);
    // La troisième note (160 Hz, dent de scie) est celle de l'app : le preset
    // `warning` du socle s'arrête à deux. Elle ne doit pas disparaître.
    expect(notes).toEqual([
      { freq: 300, type: 'square' },
      { freq: 220, type: 'square' },
      { freq: 160, type: 'sawtooth' },
    ]);
  });

  it("gradue la vibration selon l'importance de l'événement", () => {
    const { result } = renderHook(() => useFeedback());

    result.current('throw');
    result.current('elimination');
    result.current('victory');

    expect(vibrate.mock.calls).toEqual([
      [18],
      [[70, 60, 70, 60, 90]],
      [[50, 40, 50, 40, 80, 40, 140]],
    ]);
  });

  it('respecte les réglages « Sons » et « Vibrations », chacun pour soi', () => {
    useSettingsStore.setState({ sounds: true, vibrations: false });
    const { result } = renderHook(() => useFeedback());

    result.current('victory');

    expect(vibrate).not.toHaveBeenCalled();
    expect(notes.map(n => n.freq)).toEqual([523, 659, 784, 1046]);
  });

  it('se tait tout à fait quand les deux réglages sont coupés', () => {
    useSettingsStore.setState({ sounds: false, vibrations: false });
    const { result } = renderHook(() => useFeedback());

    result.current('victory');

    expect(vibrate).not.toHaveBeenCalled();
    expect(notes).toEqual([]);
  });
});

describe('le retour du plateau', () => {
  it("une quille vibre plus légèrement qu'un lancer, et un son seul ne vibre pas", () => {
    const { result } = renderHook(() => usePlaySound());

    result.current('pin-tap');
    result.current('pin-untap');
    result.current('throw-validate');

    // Deux pichenettes de 8 ms — moins qu'un lancer (18) — et rien pour le
    // son de validation joué seul.
    expect(vibrate.mock.calls).toEqual([[8], [8]]);
    expect(notes).toEqual([
      { freq: 320, type: 'triangle' },
      { freq: 200, type: 'triangle' },
      { freq: 520, type: 'square' },
      { freq: 780, type: 'sine' },
    ]);
  });
});
