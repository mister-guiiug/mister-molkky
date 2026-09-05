import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '@mister-guiiug/dev-pwa-config/react/sheet';
import { useI18n } from '../../i18n';
import { replayThrows, type RuleSettings } from '../../molkky/rules';
import type { FinishedMatch } from '../../schemas';

interface MatchReplayProps {
  match: FinishedMatch;
  open: boolean;
  onClose: () => void;
}

const TICK_MS = 900;

/**
 * Frame-by-frame replay of a finished match. The slider scrubs through
 * 0..N throws; play auto-advances every ~900 ms. Each frame replays the
 * partial throw list through the rules engine — pure, deterministic,
 * no state churn.
 *
 * Kept intentionally simple: no animation between frames besides the
 * existing ScoreTicker bounce, which fires naturally as scores change.
 */
export function MatchReplay({ match, open, onClose }: MatchReplayProps) {
  const { t } = useI18n();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when the user reopens the modal so a re-watch starts at 0.
  useEffect(() => {
    if (open) {
      setFrame(0);
      setPlaying(false);
    }
  }, [open]);

  // Auto-play tick. Stops at the end of the throw list.
  useEffect(() => {
    if (!open || !playing) return;
    if (frame >= match.throws.length) {
      setPlaying(false);
      return;
    }
    playTimer.current = setTimeout(() => {
      setFrame(f => Math.min(match.throws.length, f + 1));
    }, TICK_MS);
    return () => {
      if (playTimer.current) clearTimeout(playTimer.current);
    };
  }, [open, playing, frame, match.throws.length]);

  const settings: RuleSettings = useMemo(
    () => ({
      targetScore: match.config.targetScore,
      overshootPenalty: match.config.overshootPenalty,
      maxMisses: match.config.maxMisses,
      variant: match.config.variant ?? 'classic',
      missSanction: match.config.missSanction ?? 'elimination',
    }),
    [match.config]
  );

  const actorContext = useMemo(() => {
    const teams = match.config.teams ?? [];
    if (teams.length === 0) {
      return {
        actorIds: match.config.players.map(p => p.id as string),
        actorMap: undefined as ReadonlyMap<string, string> | undefined,
        labels: match.config.players.map(p => ({
          id: p.id as string,
          name: p.name,
          color: p.color,
        })),
      };
    }
    const actorMap = new Map<string, string>();
    for (const team of teams) {
      for (const pid of team.playerIds) actorMap.set(pid, team.id);
    }
    return {
      actorIds: teams.map(t => t.id),
      actorMap,
      labels: teams.map(team => ({
        id: team.id,
        name: team.name,
        color: team.color,
      })),
    };
  }, [match.config]);

  // Compute the outcome snapshot at this frame. Throws are sliced 0..frame.
  const snapshot = useMemo(() => {
    const slice = match.throws.slice(0, frame).map(thr => ({
      playerId: thr.playerId as string,
      fallenPins: [...thr.fallenPins] as readonly number[],
    }));
    const handicaps = new Map<string, number>(
      Object.entries(match.config.handicaps ?? {})
    );
    return replayThrows(
      actorContext.actorIds,
      slice,
      settings,
      actorContext.actorMap,
      [],
      handicaps
    );
  }, [match, frame, settings, actorContext]);

  const lastThrow = frame > 0 ? match.throws[frame - 1] : null;
  const lastPlayer = lastThrow
    ? match.config.players.find(p => p.id === lastThrow.playerId)
    : null;

  return (
    <Sheet open={open} onClose={onClose} title={t('history.replayTitle')}>
      <div className="flex flex-col gap-3">
        <div
          className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)' }}
        >
          <span style={{ color: 'var(--muted)' }}>
            {t('history.replayFrame', {
              n: frame,
              total: match.throws.length,
            })}
          </span>
          {lastPlayer && lastThrow && (
            <span className="flex items-center gap-2 font-semibold">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: lastPlayer.color }}
              />
              {lastPlayer.name} → +{lastThrow.computedScore}
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-1">
          {actorContext.labels.map(actor => {
            const p = snapshot.progress.get(actor.id);
            const isLead = snapshot.winnerId === actor.id;
            return (
              <li
                key={actor.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2"
                style={{
                  borderColor: isLead ? 'var(--accent)' : 'var(--border)',
                  background: isLead
                    ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))'
                    : 'var(--surface)',
                  opacity: p?.eliminated ? 0.5 : 1,
                }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: actor.color }}
                />
                <span className="flex-1 font-semibold">
                  {actor.name}
                  {p?.eliminated && ' ✗'}
                </span>
                <span className="text-lg font-black tabular-nums">
                  {p?.score ?? 0}
                </span>
              </li>
            );
          })}
        </ul>

        <input
          type="range"
          min={0}
          max={match.throws.length}
          value={frame}
          onChange={e => {
            setPlaying(false);
            setFrame(Number(e.target.value));
          }}
          aria-label={t('history.replayScrub')}
          className="w-full"
        />

        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setFrame(0);
            }}
            className="touch-target rounded-lg border px-3 text-sm font-bold"
            style={{ borderColor: 'var(--border)' }}
          >
            {t('history.replayReset')}
          </button>
          <button
            type="button"
            onClick={() => setPlaying(p => !p)}
            disabled={frame >= match.throws.length}
            className="touch-target rounded-lg px-5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {playing ? t('history.replayPause') : t('history.replayPlay')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
