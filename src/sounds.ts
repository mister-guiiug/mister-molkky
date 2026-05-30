/**
 * Synthesised game sounds using the Web Audio API. No audio assets to
 * download — keeps the PWA bundle small and works fully offline.
 *
 * AudioContext is lazily created on the first sound and is reused for the
 * rest of the session. On iOS Safari the context starts in 'suspended'
 * state until a user gesture, so we resume() before scheduling.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    type CtxCtor = typeof AudioContext;
    const Ctor =
      (window.AudioContext as CtxCtor | undefined) ??
      (window as unknown as { webkitAudioContext?: CtxCtor })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

interface ToneSpec {
  freq: number;
  duration: number;
  type?: OscillatorType;
  attack?: number;
  decay?: number;
  volume?: number;
}

function tone(spec: ToneSpec, startAt = 0): void {
  const c = getContext();
  if (!c) return;
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = spec.type ?? 'sine';
  osc.frequency.setValueAtTime(spec.freq, t0);
  const volume = spec.volume ?? 0.15;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + (spec.attack ?? 0.01));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + spec.duration + 0.05);
}

export type SoundEvent =
  | 'pin-tap'
  | 'pin-untap'
  | 'throw-validate'
  | 'miss'
  | 'overshoot'
  | 'elimination'
  | 'victory';

export function playSound(event: SoundEvent): void {
  switch (event) {
    case 'pin-tap':
      tone({ freq: 320, duration: 0.07, type: 'triangle', volume: 0.12 });
      break;
    case 'pin-untap':
      tone({ freq: 200, duration: 0.06, type: 'triangle', volume: 0.1 });
      break;
    case 'throw-validate':
      tone({ freq: 520, duration: 0.1, type: 'square', volume: 0.15 });
      tone({ freq: 780, duration: 0.12, type: 'sine', volume: 0.18 }, 0.06);
      break;
    case 'miss':
      tone({ freq: 180, duration: 0.18, type: 'sawtooth', volume: 0.18 });
      break;
    case 'overshoot':
      tone({ freq: 300, duration: 0.12, type: 'square', volume: 0.18 });
      tone({ freq: 220, duration: 0.18, type: 'square', volume: 0.18 }, 0.1);
      tone({ freq: 160, duration: 0.22, type: 'sawtooth', volume: 0.2 }, 0.22);
      break;
    case 'elimination':
      tone({ freq: 440, duration: 0.18, type: 'square', volume: 0.18 });
      tone({ freq: 330, duration: 0.22, type: 'square', volume: 0.2 }, 0.16);
      tone({ freq: 220, duration: 0.3, type: 'sawtooth', volume: 0.22 }, 0.34);
      break;
    case 'victory':
      tone({ freq: 523, duration: 0.18, volume: 0.2 });
      tone({ freq: 659, duration: 0.18, volume: 0.2 }, 0.16);
      tone({ freq: 784, duration: 0.18, volume: 0.2 }, 0.32);
      tone({ freq: 1046, duration: 0.36, volume: 0.22 }, 0.48);
      break;
  }
}
