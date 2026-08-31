import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n';
import { useMatchStore } from '../../store/useMatchStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import {
  accuracy,
  averageScorePerMatch,
  averageScorePerThrow,
  computeStats,
  computeWinRateTrend,
  computeWinStreak,
  headToHead,
  winRate,
  type MatchTimelineEntry,
} from '../../molkky/stats';
import { Sparkline } from '../components/Sparkline';
import { detectAchievements } from '../../molkky/achievements';
import { PageContainer } from '../components/layout/PageContainer';
import { ALL_PIN_NUMBERS } from '../../molkky/pins-layout';
import { getAchievementIcon } from '../components/icons';

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function round1(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

export function StatsView() {
  const { t } = useI18n();
  const history = useMatchStore(s => s.history);
  const roster = usePlayersStore(s => s.players);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    return computeStats(
      history.map(m => ({
        playerIds: m.config.players.map(p => p.id),
        throws: m.throws.map(t => ({
          playerId: t.playerId,
          fallenPins: [...t.fallenPins],
        })),
        winnerId: m.winnerId,
        settings: {
          targetScore: m.config.targetScore,
          overshootPenalty: m.config.overshootPenalty,
          maxMisses: m.config.maxMisses,
        },
      }))
    );
  }, [history]);

  const playersWithStats = useMemo(
    () =>
      roster
        .map(p => ({ player: p, stats: stats.get(p.id) }))
        .filter(x => x.stats),
    [roster, stats]
  );

  const effectiveId = selectedId ?? playersWithStats[0]?.player.id ?? null;
  const selected = playersWithStats.find(x => x.player.id === effectiveId);

  if (playersWithStats.length === 0) {
    return (
      <PageContainer>
        <h1 className="mt-4 text-2xl font-black">{t('stats.title')}</h1>
        <div
          className="mt-4 rounded-2xl border border-dashed p-8 text-center"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="m-0" style={{ color: 'var(--muted)' }}>
            {t('stats.empty')}
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <header className="mb-4 flex items-center justify-between gap-3 pt-4">
        <h1 className="m-0 text-2xl font-black">{t('stats.title')}</h1>
      </header>

      <div className="mb-3 flex flex-wrap gap-2">
        {playersWithStats.map(({ player: p }) => {
          const active = p.id === effectiveId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className="touch-target flex items-center gap-2 rounded-full border px-3 text-sm font-semibold"
              style={{
                background: active
                  ? `color-mix(in srgb, ${p.color} 22%, var(--surface))`
                  : 'var(--surface)',
                borderColor: active ? p.color : 'var(--border)',
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </button>
          );
        })}
      </div>

      {selected && selected.stats && (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Cell
              label={t('stats.matchesPlayed')}
              value={selected.stats.matchesPlayed}
            />
            <Cell
              label={t('stats.matchesWon')}
              value={selected.stats.matchesWon}
            />
            <Cell
              label={t('stats.winRate')}
              value={pct(winRate(selected.stats))}
            />
            <Cell label={t('stats.podiums')} value={selected.stats.podiums} />
            <Cell
              label={t('stats.bestStreak')}
              value={selected.stats.bestStreak}
            />
            <Cell
              label={t('stats.accuracy')}
              value={round1(accuracy(selected.stats))}
            />
            <Cell
              label={t('stats.avgScore')}
              value={round1(averageScorePerMatch(selected.stats))}
            />
            <Cell
              label={t('stats.avgScorePerThrow')}
              value={round1(averageScorePerThrow(selected.stats))}
            />
            <Cell
              label={t('stats.exactFifties')}
              value={selected.stats.exactFifties}
            />
            <Cell
              label={t('stats.overshoots')}
              value={selected.stats.overshoots}
            />
            <Cell
              label={t('stats.topPin')}
              value={selected.stats.topPin ?? t('stats.none')}
            />
          </dl>

          <section
            className="mt-4 rounded-2xl border p-4"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface)',
            }}
          >
            <h3
              className="mb-3 text-sm font-bold uppercase"
              style={{ color: 'var(--muted)' }}
            >
              {t('stats.pinFrequency')}
            </h3>
            <ul className="grid grid-cols-6 gap-2">
              {ALL_PIN_NUMBERS.map(pin => {
                const freq = selected.stats!.pinFrequency[pin] ?? 0;
                const max = Math.max(
                  1,
                  ...Object.values(selected.stats!.pinFrequency)
                );
                const intensity = freq / max;
                return (
                  <li
                    key={pin}
                    className="flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-bold"
                    style={{
                      borderColor: 'var(--border)',
                      background: `color-mix(in srgb, ${selected.player.color} ${Math.round(intensity * 60)}%, var(--surface))`,
                    }}
                    aria-label={`Quille ${pin}: ${freq}`}
                  >
                    <span>{pin}</span>
                    <span className="text-[0.6rem] opacity-70 tabular-nums">
                      {freq}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <StreakAndTrendSection
            playerId={selected.player.id}
            color={selected.player.color}
          />
          <AchievementsSection playerId={selected.player.id} />
          <HeadToHeadSection
            sourcePlayerId={selected.player.id}
            playerOptions={playersWithStats.map(x => x.player)}
          />
        </>
      )}
    </PageContainer>
  );
}

function AchievementsSection({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  const history = useMatchStore(s => s.history);
  const unlocked = useMemo(
    () => detectAchievements(playerId, history),
    [playerId, history]
  );
  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <h3
        className="mb-3 text-sm font-bold uppercase"
        style={{ color: 'var(--muted)' }}
      >
        {t('stats.achievements')}
      </h3>
      {unlocked.length === 0 ? (
        <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
          {t('stats.achievementsEmpty')}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {unlocked.map(a => {
            const Icon = getAchievementIcon(a.def.iconName);
            return (
              <li
                key={a.def.id}
                className="rounded-lg border p-2"
                style={{
                  borderColor: 'var(--accent)',
                  background:
                    'color-mix(in srgb, var(--accent) 8%, var(--surface))',
                }}
              >
                <div className="flex items-center gap-1.5 text-base font-bold">
                  <Icon
                    size={18}
                    aria-hidden
                    style={{ color: 'var(--accent)' }}
                  />
                  <span className="truncate">{t(a.def.labelKey)}</span>
                </div>
                <p
                  className="m-0 text-[0.7rem]"
                  style={{ color: 'var(--muted)' }}
                >
                  {t(a.def.descKey)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function HeadToHeadSection({
  sourcePlayerId,
  playerOptions,
}: {
  sourcePlayerId: string;
  playerOptions: { id: string; name: string; color: string }[];
}) {
  const { t } = useI18n();
  const history = useMatchStore(s => s.history);
  const opponents = playerOptions.filter(p => p.id !== sourcePlayerId);
  const [opponentId, setOpponentId] = useState<string | null>(
    opponents[0]?.id ?? null
  );
  const matchesInput = useMemo(
    () =>
      history.map(m => ({
        playerIds: m.config.players.map(p => p.id),
        throws: m.throws.map(t => ({
          playerId: t.playerId,
          fallenPins: [...t.fallenPins],
        })),
        winnerId: m.winnerId as string | null,
        settings: {
          targetScore: m.config.targetScore,
          overshootPenalty: m.config.overshootPenalty,
          maxMisses: m.config.maxMisses,
          variant: m.config.variant ?? 'classic',
        },
      })),
    [history]
  );
  const h2h = useMemo(() => {
    if (!opponentId) return null;
    return headToHead(matchesInput, sourcePlayerId, opponentId);
  }, [matchesInput, sourcePlayerId, opponentId]);

  if (opponents.length === 0) return null;
  const sourcePlayer = playerOptions.find(p => p.id === sourcePlayerId);
  const opponent = opponents.find(p => p.id === opponentId) ?? opponents[0]!;

  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <h3
        className="mb-3 text-sm font-bold uppercase"
        style={{ color: 'var(--muted)' }}
      >
        {t('stats.headToHead')}
      </h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {opponents.map(p => {
          const active = p.id === opponentId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpponentId(p.id)}
              className="touch-target flex items-center gap-2 rounded-full border px-3 text-sm font-semibold"
              style={{
                background: active
                  ? `color-mix(in srgb, ${p.color} 22%, var(--surface))`
                  : 'var(--surface)',
                borderColor: active ? p.color : 'var(--border)',
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: p.color }}
              />
              {p.name}
            </button>
          );
        })}
      </div>
      {h2h && h2h.sharedMatches === 0 ? (
        <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
          {t('stats.headToHeadNoMatches')}
        </p>
      ) : (
        h2h && (
          <div className="space-y-2">
            <p
              className="m-0 text-xs font-semibold"
              style={{ color: 'var(--muted)' }}
            >
              {t('stats.headToHeadMatches', { n: h2h.sharedMatches })}
            </p>
            <table className="w-full text-sm">
              <tbody>
                <H2HRow
                  label={t('stats.matchesWon')}
                  a={h2h.winsA}
                  b={h2h.winsB}
                />
                <H2HRow
                  label={t('stats.avgScore')}
                  a={Math.round(h2h.avgScoreA)}
                  b={Math.round(h2h.avgScoreB)}
                />
                <H2HRow
                  label={t('stats.accuracy')}
                  a={h2h.accuracyA.toFixed(2)}
                  b={h2h.accuracyB.toFixed(2)}
                />
              </tbody>
              <tfoot>
                <tr>
                  <td
                    className="pt-2 text-[0.7rem]"
                    style={{ color: 'var(--muted)' }}
                  >
                    {sourcePlayer?.name} ←→ {opponent.name}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </section>
  );
}

function H2HRow({
  label,
  a,
  b,
}: {
  label: string;
  a: number | string;
  b: number | string;
}) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
      <td className="py-1.5 pr-2 text-right font-black tabular-nums">{a}</td>
      <td
        className="py-1.5 text-center text-xs font-semibold"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </td>
      <td className="py-1.5 pl-2 text-left font-black tabular-nums">{b}</td>
    </tr>
  );
}

/**
 * Cross-match streak summary + rolling win-rate sparkline. Computed from
 * the full FinishedMatch history filtered down to matches the focused
 * player took part in.
 */
function StreakAndTrendSection({
  playerId,
  color,
}: {
  playerId: string;
  color: string;
}) {
  const { t } = useI18n();
  const history = useMatchStore(s => s.history);
  const { streak, trend, played } = useMemo(() => {
    const timeline: MatchTimelineEntry[] = history
      .filter(m => m.config.players.some(p => p.id === playerId))
      .map(m => ({
        id: m.id,
        finishedAt: m.finishedAt,
        won: m.winnerId === playerId,
      }));
    return {
      streak: computeWinStreak(timeline),
      trend: computeWinRateTrend(timeline, 10),
      played: timeline.length,
    };
  }, [history, playerId]);

  if (played === 0) return null;

  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <h3
        className="mb-3 text-sm font-bold uppercase"
        style={{ color: 'var(--muted)' }}
      >
        {t('stats.streakAndTrend')}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <Cell label={t('stats.currentStreak')} value={streak.currentStreak} />
        <Cell label={t('stats.bestWinStreak')} value={streak.bestStreak} />
      </div>
      {trend.length >= 2 && (
        <div className="mt-3">
          <p
            className="m-0 mb-1 text-xs font-bold uppercase"
            style={{ color: 'var(--muted)' }}
          >
            {t('stats.winRateTrend', { n: '10' })}
          </p>
          {/*
            We scale the sparkline values to a 0..1 fraction and pass
            `max=1` so the Y axis is "100 % win rate" regardless of how
            high the actual values get.
          */}
          <Sparkline
            values={trend}
            color={color}
            width={320}
            height={48}
            max={1}
            label={t('stats.winRateTrend', { n: '10' })}
            format={pct}
          />
        </div>
      )}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <dt
        className="text-[0.65rem] font-bold uppercase"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </dt>
      <dd className="m-0 text-xl font-black">{value}</dd>
    </div>
  );
}
