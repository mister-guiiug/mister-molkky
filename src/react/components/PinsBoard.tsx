import { useEffect, useRef } from 'react';
import { INITIAL_LAYOUT, LAYOUT_BOUNDS } from '../../molkky/pins-layout';
import { useI18n } from '../../i18n/useI18n';

interface PinsBoardProps {
  fallen: Set<number>;
  onToggle: (pin: number) => void;
  onSelectAll?: () => void;
  disabled?: boolean;
  playerColor?: string;
  shaking?: boolean;
}

const PIN_RADIUS = 26;
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

export function PinsBoard({
  fallen,
  onToggle,
  onSelectAll,
  disabled,
  playerColor = 'var(--primary)',
  shaking,
}: PinsBoardProps) {
  const { t } = useI18n();
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

  return (
    <div
      className={`relative mx-auto w-full max-w-md ${shaking ? 'mm-shake' : ''}`}
      style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-full w-full"
        role="group"
        aria-label={t('match.selectFallenPins')}
      >
        <defs>
          <radialGradient id="board-grass" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="var(--surface-highlight)" />
            <stop offset="100%" stopColor="var(--bg)" />
          </radialGradient>
          <linearGradient id="pin-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wood-light)" />
            <stop offset="100%" stopColor="var(--wood-deep)" />
          </linearGradient>
          <linearGradient id="pin-down" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--muted)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--muted)" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        <rect
          x="6"
          y="6"
          width={VIEW_W - 12}
          height={VIEW_H - 12}
          rx="22"
          fill="url(#board-grass)"
          stroke="var(--border)"
        />

        <text
          x={VIEW_W / 2}
          y={VIEW_H - 10}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="var(--muted)"
        >
          ↑ {t('match.tap')} ↑
        </text>

        {INITIAL_LAYOUT.map(({ pin, x, y }) => {
          const cx = projectX(x);
          const cy = projectY(y);
          const isDown = fallen.has(pin);
          const ringColor = isDown ? 'var(--muted)' : playerColor;
          return (
            <g
              key={pin}
              transform={`translate(${cx} ${cy})`}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-pressed={isDown}
              aria-label={t('a11y.pinAt', {
                n: pin,
                state: isDown ? t('match.pinDown') : t('match.pinStanding'),
              })}
              onPointerDown={() => handlePointerDown(pin)}
              onPointerUp={() => handlePointerUpOrLeave(pin, true)}
              onPointerLeave={() => handlePointerUpOrLeave(pin, false)}
              onPointerCancel={() => handlePointerUpOrLeave(pin, false)}
              onClick={e => {
                if (longPressTimers.current.has(pin)) return;
                e.preventDefault();
                if (!disabled) onToggle(pin);
              }}
              onKeyDown={e => {
                if (disabled) return;
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onToggle(pin);
                }
              }}
              style={{
                cursor: disabled ? 'default' : 'pointer',
                outline: 'none',
              }}
              className={isDown ? 'mm-pin-fall' : 'mm-pin-stand'}
            >
              <circle
                r={PIN_RADIUS + 4}
                fill="transparent"
                stroke={ringColor}
                strokeWidth="2"
                strokeOpacity={isDown ? 0.35 : 0.8}
              />
              <circle
                r={PIN_RADIUS}
                fill={isDown ? 'url(#pin-down)' : 'url(#pin-wood)'}
                stroke="var(--wood-shadow)"
                strokeWidth="1.5"
                strokeOpacity={isDown ? 0.4 : 0.9}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="18"
                fontWeight="900"
                fill={isDown ? 'var(--muted)' : 'var(--wood-shadow)'}
              >
                {pin}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
