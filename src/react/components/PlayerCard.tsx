import type { Player } from '../../schemas';

interface PlayerCardProps {
  player: Player;
  score: number;
  missStreak: number;
  maxMisses: number;
  active?: boolean;
  eliminated?: boolean;
  hasWon?: boolean;
  compact?: boolean;
  avatarUrl?: string;
  symbol?: string;
  onClick?: () => void;
}

export function PlayerCard({
  player,
  score,
  missStreak,
  maxMisses,
  active,
  eliminated,
  hasWon,
  compact,
  avatarUrl,
  symbol,
  onClick,
}: PlayerCardProps) {
  const opacity = eliminated ? 0.55 : 1;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 rounded-xl border px-3 pt-2 pb-3 text-center transition ${active ? 'mm-glow scale-[1.04]' : ''} ${compact ? 'min-w-[5rem]' : 'min-w-[6.5rem]'}`}
      style={{
        background: active
          ? `color-mix(in srgb, ${player.color} 18%, var(--surface))`
          : 'var(--surface)',
        borderColor: active ? player.color : 'var(--border)',
        borderWidth: active ? 2 : 1,
        opacity,
      }}
    >
      <span
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-black text-white"
        style={{ background: player.color }}
        aria-hidden
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          player.name.slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="truncate text-sm font-bold">
        {hasWon && '🏆 '}
        {eliminated && '✗ '}
        {symbol && <span aria-hidden>{symbol} </span>}
        {player.name}
      </span>
      <span
        className="text-2xl font-black tabular-nums"
        style={{ color: 'var(--text)' }}
      >
        {score}
      </span>
      {!eliminated && !hasWon && (
        <span className="flex gap-1" aria-label={`${missStreak} ratés`}>
          {Array.from({ length: maxMisses }).map((_, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  i < missStreak ? 'var(--danger)' : 'var(--border)',
              }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
