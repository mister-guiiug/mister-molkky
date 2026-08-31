import { useEffect, useRef } from 'react';
import { INITIAL_LAYOUT, LAYOUT_BOUNDS } from '../../molkky/pins-layout';
import { useI18n } from '../../i18n';
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
const VIEW_W = 300;
const VIEW_H = 320;

// Padding inside the board.
// PAD_X: pin 6 (rightmost, x=3.5) right edge lands at ~92 % → comfortable
//        clearance from overflow-hidden clip. Pin 5 left edge at ~8 %.
// PAD_TOP: pins 7/9/8 centre at ~12.5 % from top → clear of rounded corners.
// PAD_BOTTOM: room for the "Touchez" hint below the bottom pins.
const PAD_X = 40;
const PAD_TOP = 30;
const PAD_BOTTOM = 44;

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
        className="pointer-events-none absolute inset-x-0 text-center text-xs font-semibold"
        style={{ bottom: '0.75rem', color: 'var(--muted)' }}
      >
        {t('match.tap')}
      </span>

      {INITIAL_LAYOUT.map(({ pin, x, y }) => {
        // cx/cy are the pin's CENTRE in % of the board dimensions.
        const cx = (projectX(x) / VIEW_W) * 100;
        const cy = (projectY(y) / VIEW_H) * 100;
        const isDown = fallen.has(pin);
        const ringColor = isDown ? 'var(--muted)' : playerColor;

        // Compute the TOP-LEFT corner directly so no CSS transform or
        // negative margin is needed for centering. This keeps the
        // position stable even when mm-pin-stand/fall animations
        // override `transform` via animation-fill-mode: forwards.
        //  · halfW  : half pin width  as % of board WIDTH
        //  · halfH  : half pin height as % of board HEIGHT
        //             (pin height = pin width because aspect-ratio 1/1,
        //              but expressed in % of the taller board height)
        const halfW = pinSizePct / 2;
        const halfH = (pinSizePct / 2) * (VIEW_W / VIEW_H);
        const leftPct = cx - halfW;
        const topPct = cy - halfH;

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
            className={`absolute flex items-center justify-center rounded-full text-lg font-black tabular-nums ${isDown ? 'mm-pin-fall' : 'mm-pin-stand'}`}
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${pinSizePct}%`,
              aspectRatio: '1 / 1',
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
              // Inline opacity is used as a fallback when prefers-reduced-motion
              // disables the animation (the animation's own opacity wins otherwise).
              opacity: disabled ? 0.6 : isDown ? 0.65 : 1,
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
