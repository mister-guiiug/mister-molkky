import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useMatchStore } from '../../store/useMatchStore';
import { usePlayersStore } from '../../store/usePlayersStore';
import {
  accuracy,
  averageScorePerMatch,
  averageScorePerThrow,
  computeStats,
  winRate,
} from '../../molkky/stats';
import { PageContainer } from '../components/layout/PageContainer';
import { ALL_PIN_NUMBERS } from '../../molkky/pins-layout';

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

  const effectiveId =
    selectedId ?? playersWithStats[0]?.player.id ?? null;
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
            <Cell label={t('stats.matchesPlayed')} value={selected.stats.matchesPlayed} />
            <Cell label={t('stats.matchesWon')} value={selected.stats.matchesWon} />
            <Cell label={t('stats.winRate')} value={pct(winRate(selected.stats))} />
            <Cell label={t('stats.podiums')} value={selected.stats.podiums} />
            <Cell label={t('stats.bestStreak')} value={selected.stats.bestStreak} />
            <Cell label={t('stats.accuracy')} value={round1(accuracy(selected.stats))} />
            <Cell label={t('stats.avgScore')} value={round1(averageScorePerMatch(selected.stats))} />
            <Cell label={t('stats.avgScorePerThrow')} value={round1(averageScorePerThrow(selected.stats))} />
            <Cell label={t('stats.exactFifties')} value={selected.stats.exactFifties} />
            <Cell label={t('stats.overshoots')} value={selected.stats.overshoots} />
            <Cell
              label={t('stats.topPin')}
              value={selected.stats.topPin ?? t('stats.none')}
            />
          </dl>

          <section
            className="mt-4 rounded-2xl border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <h3 className="mb-3 text-sm font-bold uppercase" style={{ color: 'var(--muted)' }}>
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
                    <span className="text-[0.6rem] opacity-70 tabular-nums">{freq}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </PageContainer>
  );
}

function Cell({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <dt className="text-[0.65rem] font-bold uppercase" style={{ color: 'var(--muted)' }}>
        {label}
      </dt>
      <dd className="m-0 text-xl font-black">{value}</dd>
    </div>
  );
}
