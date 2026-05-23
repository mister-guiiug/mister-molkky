import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';
import {
  useCurrentPlayerInfo,
  useScoreHistories,
  useScores,
  useMatchStore,
} from '../../store/useMatchStore';
import { useAvatarUrls } from '../../store/usePlayersStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ALL_PIN_NUMBERS } from '../../molkky/pins-layout';
import { ROUTES } from '../../routes';
import { PageContainer } from '../components/layout/PageContainer';
import { PinsBoard } from '../components/PinsBoard';
import { ScoreTicker } from '../components/ScoreTicker';
import { PlayerCard } from '../components/PlayerCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EliminationToast } from '../components/EliminationToast';
import { VictoryConfetti } from '../components/VictoryConfetti';
import { FullscreenToggle } from '../components/FullscreenToggle';
import { Modal } from '../components/Modal';
import { ThrowsLog } from '../components/ThrowsLog';
import { Sparkline } from '../components/Sparkline';
import { MatchOnboardingHint } from '../components/OnboardingHint';
import { LiveShareSheet } from '../components/LiveShareSheet';
import { useLiveStore } from '../../store/useLiveStore';
import { useFeedback } from '../hooks/useFeedback';
import { useWakeLock } from '../hooks/useWakeLock';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { TrophyIcon, UndoIcon, MenuIcon, CheckIcon } from '../components/icons';

const COLORBLIND_SYMBOLS = [
  '★', '▲', '●', '◆', '■', '✦', '♥', '♣',
  '♦', '♠', '◐', '◑', '◒', '◓', '☼', '✖',
];

export function MatchView() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const current = useMatchStore(s => s.current);
  const recordThrow = useMatchStore(s => s.recordThrow);
  const undo = useMatchStore(s => s.undoLastThrow);
  const abandon = useMatchStore(s => s.abandonMatch);
  const startMatch = useMatchStore(s => s.startMatch);
  const pendingFeedback = useMatchStore(s => s.pendingFeedback);
  const clearFeedback = useMatchStore(s => s.clearFeedback);
  const playFeedback = useFeedback();

  const currentInfo = useCurrentPlayerInfo();
  const scores = useScores();
  const scoreHistories = useScoreHistories();
  const colorblind = useSettingsStore(s => s.colorblind);
  const outdoor = useSettingsStore(s => s.outdoor);
  const avatarUrls = useAvatarUrls(current?.config.players ?? []);

  const symbolForActor = (id: string) => {
    if (!colorblind) return undefined;
    const idx = current?.config.players.findIndex(p => p.id === id) ?? -1;
    return idx >= 0 ? COLORBLIND_SYMBOLS[idx % COLORBLIND_SYMBOLS.length] : undefined;
  };

  const [fallen, setFallen] = useState<Set<number>>(new Set());
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [eliminationToast, setEliminationToast] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<'none' | 'win' | 'overshoot'>('none');
  const [showVictory, setShowVictory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [throwsLogOpen, setThrowsLogOpen] = useState(false);
  const [liveShareOpen, setLiveShareOpen] = useState(false);
  const liveRole = useLiveStore(s => s.role);
  const liveCode = useLiveStore(s => s.code);
  const pushLiveThrows = useLiveStore(s => s.pushThrows);
  const pushLiveFinish = useLiveStore(s => s.pushFinish);
  const lastFinishedRef = useRef<string | null>(null);
  const lastVictoryRef = useRef<string | null>(null);

  useWakeLock(Boolean(current));

  useEffect(() => {
    if (!pendingFeedback) return;
    playFeedback(pendingFeedback);
    if (pendingFeedback === 'overshoot') {
      setShake(true);
      setFlash('overshoot');
      window.setTimeout(() => {
        setShake(false);
        setFlash('none');
      }, 600);
    } else if (pendingFeedback === 'victory') {
      setFlash('win');
    }
    clearFeedback();
  }, [pendingFeedback, playFeedback, clearFeedback]);

  const history = useMatchStore(s => s.history);
  const lastFinished = useMemo(() => history[0], [history]);

  useEffect(() => {
    if (!current && lastFinished && lastFinished.id !== lastVictoryRef.current) {
      lastVictoryRef.current = lastFinished.id;
      setShowVictory(true);
    }
  }, [current, lastFinished]);

  // Live mirror: when this device is the host, push the current throws[]
  // to Supabase on every change. Skip the very first effect run after
  // mount so we don't no-op-update right after createLiveMatch (which
  // already wrote the initial state). Finish push happens once when
  // history records the just-finished match.
  useEffect(() => {
    if (liveRole !== 'host' || !current) return;
    void pushLiveThrows(current.throws);
  }, [liveRole, current?.throws, pushLiveThrows, current]);

  useEffect(() => {
    if (liveRole !== 'host' || !lastFinished) return;
    if (lastFinished.id === lastFinishedRef.current) return;
    lastFinishedRef.current = lastFinished.id;
    void pushLiveFinish(String(lastFinished.winnerId));
  }, [liveRole, lastFinished, pushLiveFinish]);

  const togglePin = (pin: number) => {
    setFallen(prev => {
      const next = new Set(prev);
      if (next.has(pin)) next.delete(pin);
      else next.add(pin);
      return next;
    });
  };

  const selectAll = () => setFallen(new Set(ALL_PIN_NUMBERS));

  const validateThrow = () => {
    const pins = Array.from(fallen).sort((a, b) => a - b);
    const res = recordThrow(pins);
    if (!res.ok) return;
    setFallen(new Set());
    if (res.eliminated && currentInfo) {
      setEliminationToast(currentInfo.player.name);
    }
  };

  const handleMiss = () => {
    const res = recordThrow([]);
    if (!res.ok) return;
    if (res.eliminated && currentInfo) {
      setEliminationToast(currentInfo.player.name);
    }
    setFallen(new Set());
  };

  const handleUndo = () => {
    undo();
    setFallen(new Set());
  };

  useKeyboardShortcuts(
    {
      ' ': () => {
        if (current) validateThrow();
      },
      enter: () => {
        if (current) validateThrow();
      },
      z: () => handleUndo(),
      escape: () => setMenuOpen(false),
    },
    Boolean(current)
  );

  if (!current) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <p style={{ color: 'var(--muted)' }}>{t('common.empty')}</p>
          <button
            type="button"
            onClick={() => navigate(ROUTES.home)}
            className="touch-target rounded-lg px-5 font-bold text-white"
            style={{ background: 'var(--primary)' }}
          >
            {t('home.newMatch')}
          </button>
        </div>
        {showVictory && lastFinished && (
          <VictoryScreen
            onClose={() => setShowVictory(false)}
            onPlayAgain={() => {
              setShowVictory(false);
              navigate(ROUTES.home);
            }}
            onRematch={() => {
              setShowVictory(false);
              startMatch({ ...lastFinished.config, shufflePlayers: false });
            }}
            onHistory={() => {
              setShowVictory(false);
              navigate(ROUTES.history);
            }}
            winnerName={
              lastFinished.config.players.find(p => p.id === lastFinished.winnerId)
                ?.name ?? '?'
            }
            ranking={lastFinished.ranking.map(r => {
              const p = lastFinished.config.players.find(x => x.id === r.playerId);
              return { name: p?.name ?? '?', color: p?.color ?? '#999', ...r };
            })}
          />
        )}
      </PageContainer>
    );
  }

  const targetScore = current.config.targetScore;
  const maxMisses = current.config.maxMisses;
  const players = current.config.players;
  const currentPid = currentInfo?.player.id;
  const pinsCount = fallen.size;
  const previewScore =
    pinsCount === 0 ? 0 : pinsCount === 1 ? Array.from(fallen)[0]! : pinsCount;

  return (
    <PageContainer>
      <header className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6"
        style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        <div className="flex-1 truncate">
          <p className="m-0 text-xs uppercase" style={{ color: 'var(--muted)' }}>
            {t('match.turnOf')}
          </p>
          <p
            className="m-0 truncate text-lg font-black"
            style={{ color: currentInfo?.player.color ?? 'var(--text)' }}
          >
            {currentInfo?.player.name ?? '—'}
            {currentInfo?.throwingMember && (
              <span
                className="ml-2 text-sm font-semibold"
                style={{ color: 'var(--muted)' }}
              >
                · {currentInfo.throwingMember.name}
              </span>
            )}
          </p>
        </div>
        {liveRole === 'host' && (
          <span
            className="mm-glow rounded-full border px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider"
            style={{
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
            }}
            aria-label={t('live.activeBadge')}
          >
            ● {t('live.activeBadge')}
          </span>
        )}
        <FullscreenToggle />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="touch-target rounded-full p-2"
          aria-label="Menu"
          style={{ color: 'var(--muted)' }}
        >
          <MenuIcon />
        </button>
      </header>

      <section className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs uppercase" style={{ color: 'var(--muted)' }}>
            {t('match.score')}
          </p>
          <ScoreTicker
            value={currentInfo?.score ?? 0}
            flash={flash}
            size="lg"
          />
          <p
            className="mt-0 text-xs"
            style={{ color: 'var(--muted)' }}
            aria-label={`${currentInfo?.missStreak ?? 0} ${t('match.misses')} / ${maxMisses}`}
          >
            / {targetScore} · {currentInfo?.missStreak ?? 0} {t('match.misses')}
          </p>
        </div>
        <div
          className="rounded-2xl border-2 px-4 py-3 text-center"
          style={{
            borderColor:
              previewScore > 0
                ? currentInfo?.player.color ?? 'var(--primary)'
                : 'var(--border)',
            background: 'var(--surface)',
          }}
        >
          <p className="m-0 text-xs uppercase" style={{ color: 'var(--muted)' }}>
            Ce tir
          </p>
          <p className="m-0 text-3xl font-black tabular-nums">
            {previewScore > 0 ? `+${previewScore}` : '—'}
          </p>
        </div>
      </section>

      <PinsBoard
        fallen={fallen}
        onToggle={togglePin}
        onSelectAll={selectAll}
        playerColor={currentInfo?.player.color}
        shaking={shake}
        outdoor={outdoor}
      />

      <section className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={validateThrow}
          disabled={pinsCount === 0}
          className="touch-target flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg disabled:opacity-50"
          style={{ background: 'var(--primary)' }}
        >
          <CheckIcon /> {t('match.validateThrow')}{' '}
          {pinsCount > 0 && (
            <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-sm tabular-nums">
              +{previewScore}
            </span>
          )}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleMiss}
            className="touch-target flex-1 rounded-xl border-2 py-3 font-bold"
            style={{
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
            }}
          >
            {t('match.miss')} (0)
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={current.throws.length === 0}
            className="touch-target flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 font-bold disabled:opacity-50"
            style={{ borderColor: 'var(--border)' }}
          >
            <UndoIcon size={18} /> {t('match.undo')}
          </button>
        </div>
      </section>

      <section
        className="mt-5 overflow-x-auto"
        aria-label={t('match.score')}
      >
        <ul className="flex gap-2 pb-2">
          {current.config.teams && current.config.teams.length > 0
            ? current.config.teams.map(team => {
                const s = scores.get(team.id);
                const teamPlayer = {
                  id: team.id as typeof team.playerIds[number],
                  name: team.name,
                  color: team.color,
                  createdAt: 0,
                };
                const history = scoreHistories.get(team.id) ?? [];
                return (
                  <li key={team.id} className="flex flex-col items-stretch gap-1">
                    <PlayerCard
                      player={teamPlayer}
                      score={s?.score ?? 0}
                      missStreak={s?.missStreak ?? 0}
                      maxMisses={maxMisses}
                      active={team.id === currentPid}
                      eliminated={s?.eliminated}
                      hasWon={s?.hasWon}
                      symbol={symbolForActor(team.playerIds[0] ?? '')}
                      compact
                    />
                    <Sparkline
                      values={history}
                      color={team.color}
                      width={80}
                      height={18}
                      max={targetScore}
                    />
                  </li>
                );
              })
            : players.map(p => {
                const s = scores.get(p.id);
                const history = scoreHistories.get(p.id) ?? [];
                return (
                  <li key={p.id} className="flex flex-col items-stretch gap-1">
                    <PlayerCard
                      player={p}
                      score={s?.score ?? 0}
                      missStreak={s?.missStreak ?? 0}
                      maxMisses={maxMisses}
                      active={p.id === currentPid}
                      eliminated={s?.eliminated}
                      hasWon={s?.hasWon}
                      avatarUrl={avatarUrls.get(p.id)}
                      symbol={symbolForActor(p.id)}
                      compact
                    />
                    <Sparkline
                      values={history}
                      color={p.color}
                      width={80}
                      height={18}
                      max={targetScore}
                    />
                  </li>
                );
              })}
        </ul>
      </section>

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t('appName')}
        size="sm"
      >
        <ul className="flex flex-col gap-2">
          <li>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleUndo();
              }}
              className="touch-target flex w-full items-center gap-2 rounded-lg border px-3 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              <UndoIcon size={18} /> {t('match.undo')}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setThrowsLogOpen(true);
              }}
              className="touch-target flex w-full items-center gap-2 rounded-lg border px-3 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              📋 {t('match.throwsLog')}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setLiveShareOpen(true);
              }}
              className="touch-target flex w-full items-center gap-2 rounded-lg border px-3 font-semibold"
              style={{
                borderColor: liveRole === 'host' ? 'var(--danger)' : 'var(--primary)',
                color: liveRole === 'host' ? 'var(--danger)' : 'var(--primary)',
              }}
            >
              {liveRole === 'host'
                ? `🔴 ${t('live.activeBadge')} (${liveCode})`
                : `📡 ${t('live.shareTitle')}`}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirmAbandon(true);
              }}
              className="touch-target flex w-full items-center gap-2 rounded-lg border px-3 font-semibold"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
            >
              {t('match.abandon')}
            </button>
          </li>
        </ul>
      </Modal>

      <ConfirmDialog
        open={confirmAbandon}
        message={t('match.abandonConfirm')}
        onConfirm={() => {
          abandon();
          setConfirmAbandon(false);
          navigate(ROUTES.home);
        }}
        onCancel={() => setConfirmAbandon(false)}
        destructive
      />

      <ThrowsLog
        open={throwsLogOpen}
        onClose={() => setThrowsLogOpen(false)}
      />

      <EliminationToast
        playerName={eliminationToast}
        onDismiss={() => setEliminationToast(null)}
      />

      <MatchOnboardingHint />

      <LiveShareSheet
        open={liveShareOpen}
        onClose={() => setLiveShareOpen(false)}
      />

      {showVictory && lastFinished && (
        <>
          <VictoryConfetti />
          <VictoryScreen
            onClose={() => setShowVictory(false)}
            onPlayAgain={() => {
              setShowVictory(false);
              navigate(ROUTES.home);
            }}
            onRematch={() => {
              setShowVictory(false);
              startMatch({ ...lastFinished.config, shufflePlayers: false });
            }}
            onHistory={() => {
              setShowVictory(false);
              navigate(ROUTES.history);
            }}
            winnerName={
              lastFinished.config.players.find(p => p.id === lastFinished.winnerId)
                ?.name ?? '?'
            }
            ranking={lastFinished.ranking.map(r => {
              const p = lastFinished.config.players.find(x => x.id === r.playerId);
              return { name: p?.name ?? '?', color: p?.color ?? '#999', ...r };
            })}
          />
        </>
      )}
    </PageContainer>
  );
}

interface VictoryScreenProps {
  winnerName: string;
  ranking: { name: string; color: string; finalScore: number; eliminated: boolean; rank: number }[];
  onClose: () => void;
  onPlayAgain: () => void;
  onRematch: () => void;
  onHistory: () => void;
}

function VictoryScreen({
  winnerName,
  ranking,
  onClose,
  onPlayAgain,
  onRematch,
  onHistory,
}: VictoryScreenProps) {
  const { t } = useI18n();
  return (
    <Modal open onClose={onClose}>
      <div className="mm-victory-pop flex flex-col items-center gap-3 text-center">
        <TrophyIcon size={56} style={{ color: 'var(--accent)' }} />
        <h2 className="m-0 text-2xl font-black">{t('match.victory')}</h2>
        <p className="m-0 text-lg">
          {t('match.victoryMessage', { name: winnerName })}
        </p>
      </div>
      <ol className="my-5 flex flex-col gap-1.5">
        {ranking.map(r => (
          <li
            key={r.name + r.rank}
            className="flex items-center gap-3 rounded-lg border px-3 py-2"
            style={{
              borderColor: r.rank === 1 ? 'var(--accent)' : 'var(--border)',
              background:
                r.rank === 1
                  ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))'
                  : 'var(--surface)',
            }}
          >
            <span className="w-6 text-center text-sm font-bold" style={{ color: 'var(--muted)' }}>
              {r.rank}
            </span>
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: r.color }}
            />
            <span className="flex-1 truncate font-semibold">
              {r.eliminated && '✗ '}
              {r.name}
            </span>
            <span className="font-black tabular-nums">{r.finalScore}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onHistory}
          className="touch-target rounded-lg border px-4 font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('match.seeRanking')}
        </button>
        <button
          type="button"
          onClick={onPlayAgain}
          className="touch-target rounded-lg border px-4 font-semibold"
          style={{ borderColor: 'var(--border)' }}
        >
          {t('match.playAgain')}
        </button>
        <button
          type="button"
          onClick={onRematch}
          className="touch-target rounded-lg px-4 font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          🔁 {t('match.rematch')}
        </button>
      </div>
    </Modal>
  );
}
