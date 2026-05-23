import { useEffect, useRef } from 'react';
import { INITIAL_LAYOUT, LAYOUT_BOUNDS } from '../../molkky/pins-layout';
import { useI18n } from '../../i18n/useI18n';
import { usePlaySound } from '../hooks/useFeedback';

interface PinsBoardProps {
  fallen: Set<number>;
  onToggle: (pin: number) => void;
  onSelectAll?: () => void;
  disabled?: boolean;
  playerColor?: string;
  shaking?: boolean;
  outdoor?: boolean;
}

// Board virtual dimensions kept from the original SVG so the projection
// matches existing tests.
const VIEW_W = 360;
const VIEW_H = 320;

function projectX(x: number): number {
  const padding = 30;
  const usable = VIEW_W - padding * 2;
  const span = LAYOUT_BOUNDS.maxX - LAYOUT_BOUNDS.minX;
  return padding + ((x - LAYOUT_BOUNDS.minX) / span) * usable;
}

function projectY(y: number): number {
  const padding = 24;
  const usable = VIEW_H - padding * 2 - 30;
  const span = LAYOUT_BOUNDS.maxY - LAYOUT_BOUNDS.minY;
  return VIEW_H - padding - ((y - LAYOUT_BOUNDS.minY) / span) * usable;
}

/**
 * 12-pin Mölkky board.
 *
 * Switched from a single SVG with viewBox to HTML elements positioned
 * via percentages because the viewBox approach was unreliable on iOS
 * Safari: preserveAspectRatio + CSS aspect-ratio sometimes left the SVG
 * content collapsed in the top-left corner. With percentage positioning
 * the browser only has to honour the container's aspect-ratio
 * (well-supported) and the pins inherit responsive sizing automatically.
 */
export function PinsBoard({
  fallen,
  onToggle,
  onSelectAll,
  disabled,
  playerColor = 'var(--primary)',
  shaking,
  outdoor,
}: PinsBoardProps) {
  const { t } = useI18n();
  const playSound = usePlaySound();
  const longPressTimers = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    return () => {
      longPressTimers.current.forEach(id => window.clearTimeout(id));
      longPressTimers.current.clear();
    };
  }, []);

  const handlePointerDown = (pin: number) => {
    if (disabled) return;
    if (!onSelectAll) return;
    const tid = window.setTimeout(() => {
      onSelectAll();
      longPressTimers.current.delete(pin);
    }, 500);
    longPressTimers.current.set(pin, tid);
  };

  const handlePointerUpOrLeave = (pin: number, fired: boolean) => {
    const tid = longPressTimers.current.get(pin);
    if (tid !== undefined) {
      window.clearTimeout(tid);
      longPressTimers.current.delete(pin);
      if (fired) onToggle(pin);
    }
  };

  // Pin size as a percentage of the container width. The original SVG used
  // r=26 inside a 360-wide viewBox → ~14.4 % per pin; we bump it to 15 %
  // so the touch target stays comfortable on small viewports (380 px →
  // 57 px button), 17 % in outdoor mode for low-light readability.
  const pinSizePct = outdoor ? 17 : 15;

  return (
    <div
      role="group"
      aria-label={t('match.selectFallenPins')}
      data-testid="pins-board"
      className={`relative mx-auto w-full ${outdoor ? 'max-w-xl' : 'max-w-md'} overflow-hidden rounded-2xl border ${shaking ? 'mm-shake' : ''}`}
      style={{
        aspectRatio: `${VIEW_W} / ${VIEW_H}`,
        background:
          'radial-gradient(circle at 50% 40%, var(--surface-highlight) 0%, var(--bg) 100%)',
        borderColor: 'var(--border)',
        filter: outdoor ? 'contrast(1.15)' : undefined,
        touchAction: 'manipulation',
      }}
    >
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-xs font-semibold"
        style={{ bottom: '0.5rem', color: 'var(--muted)' }}
      >
        ↑ {t('match.tap')} ↑
      </span>

      {INITIAL_LAYOUT.map(({ pin, x, y }) => {
        const cx = (projectX(x) / VIEW_W) * 100;
        const cy = (projectY(y) / VIEW_H) * 100;
        const isDown = fallen.has(pin);
        const ringColor = isDown ? 'var(--muted)' : playerColor;
        return (
          <button
            key={pin}
            type="button"
            aria-pressed={isDown}
            aria-label={t('a11y.pinAt', {
              n: pin,
              state: isDown ? t('match.pinDown') : t('match.pinStanding'),
            })}
            disabled={disabled}
            onPointerDown={() => handlePointerDown(pin)}
            onPointerUp={() => handlePointerUpOrLeave(pin, true)}
            onPointerLeave={() => handlePointerUpOrLeave(pin, false)}
            onPointerCancel={() => handlePointerUpOrLeave(pin, false)}
            onClick={e => {
              if (longPressTimers.current.has(pin)) return;
              e.preventDefault();
              if (!disabled) {
                playSound(fallen.has(pin) ? 'pin-untap' : 'pin-tap');
                onToggle(pin);
              }
            }}
            className={`absolute flex items-center justify-center rounded-full text-lg font-black tabular-nums transition-transform ${isDown ? 'mm-pin-fall' : 'mm-pin-stand'}`}
            style={{
              left: `${cx}%`,
              top: `${cy}%`,
              width: `${pinSizePct}%`,
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
              background: isDown
                ? 'color-mix(in srgb, var(--muted) 30%, transparent)'
                : 'linear-gradient(to bottom, var(--wood-light), var(--wood-deep))',
              border: `2px solid ${ringColor}`,
              outline: 'none',
              outlineOffset: 2,
              boxShadow: isDown
                ? 'none'
                : `0 0 0 4px color-mix(in srgb, ${ringColor} 14%, transparent)`,
              color: isDown ? 'var(--muted)' : 'var(--wood-shadow)',
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'default' : 'pointer',
            }}
          >
            {pin}
          </button>
        );
      })}
    </div>
  );
}
