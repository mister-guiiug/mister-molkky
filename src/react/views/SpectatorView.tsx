import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
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
    return () => {
      stopViewer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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
    const scores = new Map<string, { score: number; missStreak: number; eliminated: boolean }>();
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
      <header className="mt-4 mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="m-0 text-xs uppercase" style={{ color: 'var(--muted)' }}>
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
