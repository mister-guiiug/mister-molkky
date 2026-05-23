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

// Padding inside the board so the edge pins (5, 6 horizontally; 1, 2 at
// the bottom) stay clear of the rounded corners + overflow-hidden clip.
// PAD_BOTTOM is generous so the "↑ Touchez ↑" hint sits cleanly below
// the bottom row of pins instead of being covered by them.
const PAD_X = 50;
const PAD_TOP = 36;
const PAD_BOTTOM = 76;

function projectX(x: number): number {
  const usable = VIEW_W - PAD_X * 2;
  const span = LAYOUT_BOUNDS.maxX - LAYOUT_BOUNDS.minX;
  return PAD_X + ((x - LAYOUT_BOUNDS.minX) / span) * usable;
}

function projectY(y: number): number {
  const usable = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const span = LAYOUT_BOUNDS.maxY - LAYOUT_BOUNDS.minY;
  return VIEW_H - PAD_BOTTOM - ((y - LAYOUT_BOUNDS.minY) / span) * usable;
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
  // Pins for which the long-press fired since the last click. We
  // consume this set in onClick to skip the toggle that would otherwise
  // happen for the short-tap path.
  const longPressFired = useRef<Set<number>>(new Set());

  useEffect(() => {
    return () => {
      longPressTimers.current.forEach(id => window.clearTimeout(id));
      longPressTimers.current.clear();
      longPressFired.current.clear();
    };
  }, []);

  const armLongPress = (pin: number) => {
    if (disabled || !onSelectAll) return;
    const tid = window.setTimeout(() => {
      longPressFired.current.add(pin);
      onSelectAll();
      longPressTimers.current.delete(pin);
    }, 500);
    longPressTimers.current.set(pin, tid);
  };

  const cancelLongPress = (pin: number) => {
    const tid = longPressTimers.current.get(pin);
    if (tid !== undefined) {
      window.clearTimeout(tid);
      longPressTimers.current.delete(pin);
    }
  };

  const handleClick = (pin: number) => {
    if (disabled) return;
    cancelLongPress(pin);
    if (longPressFired.current.has(pin)) {
      longPressFired.current.delete(pin);
      return;
    }
    playSound(fallen.has(pin) ? 'pin-untap' : 'pin-tap');
    onToggle(pin);
  };

  // Pin size as a percentage of the container width. Sized to stay clear
  // of the rounded-corner clip even at the extreme x/y positions; the
  // projection padding above does the heavy lifting.
  const pinSizePct = outdoor ? 15 : 13;

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
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold"
        style={{ bottom: '0.6rem', color: 'var(--muted)' }}
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
            onPointerDown={() => armLongPress(pin)}
            onPointerLeave={() => cancelLongPress(pin)}
            onPointerCancel={() => cancelLongPress(pin)}
            onClick={e => {
              e.preventDefault();
              handleClick(pin);
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
