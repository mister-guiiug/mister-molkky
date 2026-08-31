import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useLiveStore } from '../../store/useLiveStore';
import { isSupabaseConfigured } from '../../supabase';
import {
  evaluateThrow,
  initialScore,
  type RuleSettings,
} from '../../molkky/rules';
import { ROUTES } from '../../routes';
import { PageContainer } from '../components/layout/PageContainer';
import { PlayerCard } from '../components/PlayerCard';
import { Sparkline } from '../components/Sparkline';
import { PullIndicator } from '../components/PullIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import {
  notifyLiveEvent,
  requestNotificationPermission,
} from '../../live/notifications';

export function SpectatorView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const startViewer = useLiveStore(s => s.startViewer);
  const stopViewer = useLiveStore(s => s.stopViewer);
  const role = useLiveStore(s => s.role);
  const remote = useLiveStore(s => s.remote);
  const error = useLiveStore(s => s.error);
  const status = useLiveStore(s => s.status);
  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    if (!code || !supabaseReady) return;
    if (role !== 'viewer' || useLiveStore.getState().code !== code) {
      void startViewer(code).catch(() => undefined);
    }
    // Best-effort: ask for notification permission once. The store-level
    // auto-reconnect handles dropped connections; this hook adds the
    // user-facing "ping" when something happens while the tab is hidden.
    void requestNotificationPermission();
    return () => {
      stopViewer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Browser notifications on remote updates. Track the last-seen throw
  // count and winner id so we only fire on *transitions*, not on every
  // render. Tags scoped to the match code so old notifications get
  // replaced rather than stacking.
  const lastThrowCountRef = useRef<number>(0);
  const notifiedFinishRef = useRef<string | null>(null);
  useEffect(() => {
    if (!remote) return;
    const prevCount = lastThrowCountRef.current;
    const nextCount = remote.throws.length;
    lastThrowCountRef.current = nextCount;
    // Initial render: don't fire a notif just because we mounted.
    if (prevCount === 0) return;
    if (nextCount > prevCount) {
      const last = remote.throws[nextCount - 1];
      if (last) {
        const isElim = last.resultedInElimination;
        const score = last.computedScore;
        notifyLiveEvent({
          title: t('live.notifThrowTitle'),
          body: isElim
            ? t('live.notifElimination')
            : t('live.notifThrow', { n: score }),
          tag: `live-${remote.code}`,
        });
      }
    }
    if (remote.winner_id && notifiedFinishRef.current !== remote.winner_id) {
      notifiedFinishRef.current = remote.winner_id;
      const winnerName =
        remote.config.players.find(p => p.id === remote.winner_id)?.name ??
        remote.config.teams?.find(team => team.id === remote.winner_id)?.name ??
        '?';
      notifyLiveEvent({
        title: t('live.notifVictoryTitle'),
        body: t('match.victoryMessage', { name: winnerName }),
        tag: `live-${remote.code}`,
        // Victory is rare and high-value — show it even if the tab is
        // active so the host sees the "ding".
        forceShow: true,
      });
    }
  }, [remote, t]);

  const onPullRefresh = useCallback(async () => {
    if (!code) return;
    stopViewer();
    try {
      await startViewer(code);
    } catch {
      /* error already surfaced via useLiveStore.error */
    }
  }, [code, startViewer, stopViewer]);
  const pull = usePullToRefresh({
    onRefresh: onPullRefresh,
    enabled: Boolean(code) && supabaseReady,
  });

  const computed = useMemo(() => {
    if (!remote) return null;
    const config = remote.config;
    const teamMap = new Map<string, string>();
    for (const team of config.teams ?? []) {
      for (const pid of team.playerIds) teamMap.set(pid, team.id);
    }
    const isTeamMode = (config.teams?.length ?? 0) > 0;
    const actors = isTeamMode
      ? config.teams.map(team => ({
          id: team.id,
          name: team.name,
          color: team.color,
        }))
      : config.players.map(p => ({ id: p.id, name: p.name, color: p.color }));

    const settings: RuleSettings = {
      targetScore: config.targetScore,
      overshootPenalty: config.overshootPenalty,
      maxMisses: config.maxMisses,
      variant: config.variant ?? 'classic',
    };
    const start = initialScore(settings);
    const scores = new Map<
      string,
      { score: number; missStreak: number; eliminated: boolean }
    >();
    const histories = new Map<string, number[]>();
    for (const a of actors) {
      scores.set(a.id, { score: start, missStreak: 0, eliminated: false });
      histories.set(a.id, [start]);
    }
    for (const t of remote.throws) {
      const actor = teamMap.get(t.playerId) ?? t.playerId;
      const prev = scores.get(actor);
      if (!prev) continue;
      const e = evaluateThrow(prev.score, t.fallenPins, settings);
      const nextMiss = e.score === 0 ? prev.missStreak + 1 : 0;
      scores.set(actor, {
        score: e.nextScore,
        missStreak: nextMiss,
        eliminated: nextMiss >= settings.maxMisses,
      });
      histories.get(actor)?.push(e.nextScore);
    }
    return { actors, scores, histories, settings };
  }, [remote]);

  if (!supabaseReady) {
    return (
      <PageContainer>
        <p className="mt-6 text-sm" style={{ color: 'var(--muted)' }}>
          {t('live.notConfigured')}
        </p>
      </PageContainer>
    );
  }

  if (status === 'connecting' || (!remote && !error)) {
    return (
      <PageContainer>
        <p className="mt-6 text-sm" style={{ color: 'var(--muted)' }}>
          {t('common.loading')}
        </p>
      </PageContainer>
    );
  }

  if (status === 'reconnecting' && !remote) {
    return (
      <PageContainer>
        <p className="mt-6 text-sm" style={{ color: 'var(--warning)' }}>
          {t('live.reconnecting')}
        </p>
      </PageContainer>
    );
  }

  if (error || !remote || !computed) {
    return (
      <PageContainer>
        <p className="mt-6 text-sm" style={{ color: 'var(--danger)' }}>
          {error ?? t('live.joinFailed')}
        </p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.home)}
          className="touch-target mt-3 rounded-lg border px-3 py-2 font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('live.spectatorLeave')}
        </button>
      </PageContainer>
    );
  }

  const finished = Boolean(remote.finished_at);
  const winner = remote.winner_id
    ? computed.actors.find(a => a.id === remote.winner_id)
    : null;

  return (
    <PageContainer>
      <PullIndicator
        pulling={pull.pulling}
        progress={pull.progress}
        refreshing={pull.refreshing}
        label={t('live.spectatorLive')}
      />
      {status === 'reconnecting' && (
        <p
          className="mt-4 mb-2 rounded-lg border px-3 py-2 text-xs font-bold"
          style={{
            borderColor: 'var(--warning)',
            color: 'var(--warning)',
            background:
              'color-mix(in srgb, var(--warning) 10%, var(--surface))',
          }}
          role="status"
          aria-live="polite"
        >
          ● {t('live.reconnecting')}
        </p>
      )}
      <header className="mt-4 mb-4 flex items-center justify-between gap-2">
        <div>
          <p
            className="m-0 text-xs uppercase"
            style={{ color: 'var(--muted)' }}
          >
            {t('live.spectatorTitle')}
          </p>
          <p
            className="m-0 font-mono text-lg font-black tracking-[0.2em]"
            style={{ color: 'var(--primary)' }}
          >
            {remote.code}
          </p>
        </div>
        <span
          className={finished ? '' : 'mm-glow'}
          style={{
            background: finished
              ? 'color-mix(in srgb, var(--muted) 18%, var(--surface))'
              : 'color-mix(in srgb, var(--danger) 18%, var(--surface))',
            color: finished ? 'var(--muted)' : 'var(--danger)',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontWeight: 900,
            fontSize: '0.75rem',
            border: `1px solid ${finished ? 'var(--muted)' : 'var(--danger)'}`,
          }}
        >
          ● {finished ? t('live.spectatorFinished') : t('live.spectatorLive')}
        </span>
      </header>

      {winner && (
        <div
          className="mm-victory-pop mb-4 rounded-2xl border-2 p-4 text-center"
          style={{
            borderColor: 'var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))',
          }}
        >
          <p className="m-0 text-xl font-black">
            🏆 {t('match.victoryMessage', { name: winner.name })}
          </p>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-2">
        {computed.actors.map(a => {
          const s = computed.scores.get(a.id);
          const h = computed.histories.get(a.id) ?? [];
          return (
            <li key={a.id} className="flex flex-col items-stretch gap-1">
              <PlayerCard
                player={{
                  id: a.id as unknown as never,
                  name: a.name,
                  color: a.color,
                  createdAt: 0,
                }}
                score={s?.score ?? 0}
                missStreak={s?.missStreak ?? 0}
                maxMisses={computed.settings.maxMisses}
                eliminated={s?.eliminated}
                hasWon={a.id === remote.winner_id}
                compact
              />
              <Sparkline
                values={h}
                color={a.color}
                width={100}
                height={20}
                max={computed.settings.targetScore}
                label={t('a11y.scoreTrend', { name: a.name })}
              />
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-center text-xs" style={{ color: 'var(--muted)' }}>
        {remote.throws.length} lancers
      </p>

      <button
        type="button"
        onClick={() => {
          stopViewer();
          navigate(ROUTES.home);
        }}
        className="touch-target mt-4 w-full rounded-lg border px-3 py-2 font-semibold"
        style={{ borderColor: 'var(--border)' }}
      >
        {t('live.spectatorLeave')}
      </button>
    </PageContainer>
  );
}
