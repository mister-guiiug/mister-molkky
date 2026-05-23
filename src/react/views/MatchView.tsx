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
import { ForfeitPlayerSheet } from '../components/ForfeitPlayerSheet';
import { PredictionsSheet } from '../components/PredictionsSheet';
import { Chrono } from '../components/Chrono';
import { SituationPhoto } from '../components/SituationPhoto';
import { useLiveStore } from '../../store/useLiveStore';
import { useFeedback } from '../hooks/useFeedback';
import { useWakeLock } from '../hooks/useWakeLock';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useSwipeDown } from '../hooks/useSwipeDown';
import {
  announceElimination,
  announceOvershoot,
  announceTurn,
} from '../../tts';
import {
  CheckIcon,
  ClipboardIcon,
  ForfeitIcon,
  LightbulbIcon,
  LiveIcon,
  MenuIcon,
  RematchIcon,
  ShareIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon,
  UndoIcon,
} from '../components/icons';
import { buildShareCard, shareCard } from '../../shareCard';
import { suggestThrow } from '../../molkky/rules';

const COLORBLIND_SYMBOLS = [
  '★',
  '▲',
  '●',
  '◆',
  '■',
  '✦',
  '♥',
  '♣',
  '♦',
  '♠',
  '◐',
  '◑',
  '◒',
  '◓',
  '☼',
  '✖',
];

// Stable empty array reference for useAvatarUrls when there is no
// active match — avoids handing the hook a fresh ref on every render.
const EMPTY_PLAYERS: readonly { id: string; avatarBlobKey?: string }[] = [];

export function MatchView() {
  const { t, locale } = useI18n();
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
  const coachEnabled = useSettingsStore(s => s.coach);
  const voiceEnabled = useSettingsStore(s => s.voiceAnnouncer);
  const toggleHighlight = useMatchStore(s => s.toggleHighlight);
  // Memoise the player list so the inline `?? []` fallback doesn't hand
  // useAvatarUrls a fresh array reference on every render — see hook
  // comment for why that would freeze the screen.
  const matchPlayers = useMemo(
    () => current?.config.players ?? EMPTY_PLAYERS,
    [current]
  );
  const avatarUrls = useAvatarUrls(matchPlayers);

  const symbolForActor = (id: string) => {
    if (!colorblind) return undefined;
    const idx = current?.config.players.findIndex(p => p.id === id) ?? -1;
    return idx >= 0
      ? COLORBLIND_SYMBOLS[idx % COLORBLIND_SYMBOLS.length]
      : undefined;
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
  const [forfeitSheetOpen, setForfeitSheetOpen] = useState(false);
  const [predictionsOpen, setPredictionsOpen] = useState(false);
  // Call-your-shot: pin the active player has announced before throwing.
  // Cleared after every recordThrow so each shot is a fresh declaration.
  const [calledPin, setCalledPin] = useState<number | null>(null);
  const [callPickerOpen, setCallPickerOpen] = useState(false);
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
      if (voiceEnabled) announceOvershoot(locale);
    } else if (pendingFeedback === 'victory') {
      setFlash('win');
    } else if (
      pendingFeedback === 'elimination' &&
      voiceEnabled &&
      currentInfo
    ) {
      announceElimination(currentInfo.player.name, locale);
    }
    clearFeedback();
  }, [
    pendingFeedback,
    playFeedback,
    clearFeedback,
    voiceEnabled,
    locale,
    currentInfo,
  ]);

  // Voice "à toi NAME" when the active player changes. Skip the very
  // first render — speaking on mount feels intrusive.
  const lastSpokenPlayerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!voiceEnabled || !currentInfo) return;
    const id = currentInfo.player.id;
    if (lastSpokenPlayerRef.current === null) {
      lastSpokenPlayerRef.current = id;
      return;
    }
    if (lastSpokenPlayerRef.current === id) return;
    lastSpokenPlayerRef.current = id;
    announceTurn(currentInfo.player.name, locale);
  }, [currentInfo, voiceEnabled, locale]);

  const history = useMatchStore(s => s.history);
  const lastFinished = useMemo(() => history[0], [history]);

  useEffect(() => {
    if (
      !current &&
      lastFinished &&
      lastFinished.id !== lastVictoryRef.current
    ) {
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
    const res = recordThrow(
      pins,
      calledPin != null ? { calledPin } : undefined
    );
    if (!res.ok) return;
    setFallen(new Set());
    setCalledPin(null);
    if (res.eliminated && currentInfo) {
      setEliminationToast(currentInfo.player.name);
    }
  };

  const handleMiss = () => {
    const res = recordThrow([], calledPin != null ? { calledPin } : undefined);
    if (!res.ok) return;
    if (res.eliminated && currentInfo) {
      setEliminationToast(currentInfo.player.name);
    }
    setFallen(new Set());
    setCalledPin(null);
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

  // Swipe down on the score-header section to open the throws log
  // (shortcut for "rectifier le dernier lancer"). The hook returns
  // touch handlers we spread onto the <section>.
  const swipeDown = useSwipeDown({
    onSwipeDown: () => {
      if (current && current.throws.length > 0) setThrowsLogOpen(true);
    },
  });

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
              lastFinished.config.players.find(
                p => p.id === lastFinished.winnerId
              )?.name ?? '?'
            }
            ranking={lastFinished.ranking.map(r => {
              const p = lastFinished.config.players.find(
                x => x.id === r.playerId
              );
              return { name: p?.name ?? '?', color: p?.color ?? '#999', ...r };
            })}
            correctPredictors={resolveCorrectPredictors(lastFinished)}
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
      <header
        className="sticky top-0 z-20 -mx-4 mb-4 flex items-center gap-2 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6"
        style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)' }}
      >
        <div className="flex-1 truncate">
          <p
            className="m-0 text-xs uppercase"
            style={{ color: 'var(--muted)' }}
          >
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
        <Chrono
          startedAt={current.startedAt}
          className="rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums"
          aria-label={t('match.chrono')}
        />
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

      <section
        className="mb-4 flex items-center justify-between gap-3"
        // Swipe down on the score header → open the throws log so the
        // user can rectify the last throw without going through the
        // burger menu. Only active while a match is running.
        {...swipeDown}
      >
        <div>
          <p
            className="m-0 text-xs uppercase"
            style={{ color: 'var(--muted)' }}
          >
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
                ? (currentInfo?.player.color ?? 'var(--primary)')
                : 'var(--border)',
            background: 'var(--surface)',
          }}
        >
          <p
            className="m-0 text-xs uppercase"
            style={{ color: 'var(--muted)' }}
          >
            Ce tir
          </p>
          <p className="m-0 text-3xl font-black tabular-nums">
            {previewScore > 0 ? `+${previewScore}` : '—'}
          </p>
        </div>
      </section>

      {coachEnabled &&
        currentInfo &&
        (() => {
          const suggestion = suggestThrow(currentInfo.score, {
            targetScore: current.config.targetScore,
            overshootPenalty: current.config.overshootPenalty,
            maxMisses: current.config.maxMisses,
            variant: current.config.variant ?? 'classic',
          });
          // Don't render anything if the coach has nothing useful to say —
          // e.g. score is 0 and target is 50, every single pin is fine, no
          // "best single" exists. Showing an empty hint would be noisy.
          if (!suggestion.bestSinglePin && !suggestion.bestMultiCount) {
            return null;
          }
          return (
            <div
              className="mb-3 flex items-start gap-2 rounded-lg border-l-4 px-3 py-2 text-sm"
              style={{
                borderColor: 'var(--accent)',
                background:
                  'color-mix(in srgb, var(--accent) 8%, var(--surface))',
              }}
              role="status"
              aria-live="polite"
            >
              <LightbulbIcon
                size={18}
                style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}
                aria-hidden
              />
              <div className="flex flex-col gap-0.5">
                <p className="m-0 font-bold">{t('match.coachLabel')}</p>
                <p className="m-0" style={{ color: 'var(--muted)' }}>
                  {suggestion.bestSinglePin !== null
                    ? t('match.coachSingle', {
                        n: suggestion.bestSinglePin,
                      })
                    : suggestion.bestMultiCount !== null
                      ? t('match.coachMulti', { n: suggestion.bestMultiCount })
                      : ''}
                  {suggestion.avoidSingles.length > 0 && (
                    <>
                      {' · '}
                      <span style={{ color: 'var(--danger)' }}>
                        {t('match.coachAvoid', {
                          pins: suggestion.avoidSingles.join(', '),
                        })}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })()}

      <div className="mb-2 flex items-center justify-end">
        <SituationPhoto />
      </div>
      <PinsBoard
        fallen={fallen}
        onToggle={togglePin}
        onSelectAll={selectAll}
        playerColor={currentInfo?.player.color}
        shaking={shake}
        outdoor={outdoor}
      />

      <section className="mt-4 flex flex-col gap-2">
        {/*
          Call-your-shot bar. Compact one-liner with current declaration
          and a "Modifier" tap to reopen the picker. Empty state nudges
          the user with a small ghost button instead of taking vertical
          space with a permanent CTA.
        */}
        <div
          className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-1.5 text-xs"
          style={{
            borderColor: calledPin != null ? 'var(--accent)' : 'var(--border)',
            color: calledPin != null ? 'var(--accent)' : 'var(--muted)',
          }}
        >
          <span className="flex items-center gap-1 font-semibold">
            <TargetIcon size={14} />
            {calledPin != null
              ? t('match.calledPinIs', { n: calledPin })
              : t('match.callYourShotPrompt')}
          </span>
          <button
            type="button"
            onClick={() => setCallPickerOpen(true)}
            className="touch-target rounded px-2 font-bold underline"
          >
            {calledPin != null ? t('common.edit') : t('match.callYourShot')}
          </button>
        </div>

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
          {/*
            Star button: stamps the last throw as a "highlight" so the
            user can find it in the throws log + ranking later. The
            button visually fills in once the most recent throw is
            starred, making the toggle state obvious without an extra
            label.
          */}
          {(() => {
            const lastThrow = current.throws[current.throws.length - 1];
            // `?? []` so a legacy match without highlightedThrowIds (saved
            // before that feature shipped) doesn't blow up on .includes().
            const highlights = current.highlightedThrowIds ?? [];
            const isStarred = Boolean(
              lastThrow && highlights.includes(lastThrow.id)
            );
            return (
              <button
                type="button"
                onClick={() => {
                  if (lastThrow) toggleHighlight(lastThrow.id);
                }}
                disabled={!lastThrow}
                title={t('match.markHighlight')}
                aria-label={t('match.markHighlight')}
                aria-pressed={isStarred}
                className="touch-target flex items-center justify-center gap-1 rounded-xl border py-3 px-4 font-bold disabled:opacity-50"
                style={{
                  borderColor: isStarred ? 'var(--accent)' : 'var(--border)',
                  color: isStarred ? 'var(--accent)' : 'var(--muted)',
                  background: isStarred
                    ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))'
                    : 'transparent',
                }}
              >
                <StarIcon
                  size={20}
                  fill={isStarred ? 'currentColor' : 'none'}
                />
              </button>
            );
          })()}
        </div>
      </section>

      <section className="mt-5 overflow-x-auto" aria-label={t('match.score')}>
        {/*
          py-3 + px-2 keep the active card's scale-[1.04] transform inside
          the section's content box — overflow-x-auto forces overflow-y to
          'auto' too, so without the padding the top/bottom of the scaled
          card and its glow get clipped on small screens.
        */}
        <ul className="flex gap-2 px-2 py-3">
          {current.config.teams && current.config.teams.length > 0
            ? current.config.teams.map(team => {
                const s = scores.get(team.id);
                const teamPlayer = {
                  id: team.id as (typeof team.playerIds)[number],
                  name: team.name,
                  color: team.color,
                  createdAt: 0,
                };
                const history = scoreHistories.get(team.id) ?? [];
                return (
                  <li
                    key={team.id}
                    className="flex flex-col items-stretch gap-1"
                  >
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
              <ClipboardIcon size={18} /> {t('match.throwsLog')}
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
                borderColor:
                  liveRole === 'host' ? 'var(--danger)' : 'var(--primary)',
                color: liveRole === 'host' ? 'var(--danger)' : 'var(--primary)',
              }}
            >
              <LiveIcon size={18} />
              {liveRole === 'host'
                ? `${t('live.activeBadge')} (${liveCode})`
                : t('live.shareTitle')}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setPredictionsOpen(true);
              }}
              className="touch-target flex w-full items-center gap-2 rounded-lg border px-3 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              <TrophyIcon size={18} /> {t('match.predictions')}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setForfeitSheetOpen(true);
              }}
              className="touch-target flex w-full items-center gap-2 rounded-lg border px-3 font-semibold"
              style={{ borderColor: 'var(--border)' }}
            >
              <ForfeitIcon size={18} /> {t('match.forfeitPlayer')}
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

      <ThrowsLog open={throwsLogOpen} onClose={() => setThrowsLogOpen(false)} />

      <EliminationToast
        playerName={eliminationToast}
        onDismiss={() => setEliminationToast(null)}
      />

      <MatchOnboardingHint />

      <LiveShareSheet
        open={liveShareOpen}
        onClose={() => setLiveShareOpen(false)}
      />

      <ForfeitPlayerSheet
        open={forfeitSheetOpen}
        onClose={() => setForfeitSheetOpen(false)}
      />

      <PredictionsSheet
        open={predictionsOpen}
        onClose={() => setPredictionsOpen(false)}
      />

      <Modal
        open={callPickerOpen}
        onClose={() => setCallPickerOpen(false)}
        title={t('match.callYourShotTitle')}
        size="sm"
      >
        <p className="m-0 mb-3 text-sm" style={{ color: 'var(--muted)' }}>
          {t('match.callYourShotHint')}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {ALL_PIN_NUMBERS.map(pin => {
            const selected = calledPin === pin;
            return (
              <button
                key={pin}
                type="button"
                onClick={() => {
                  setCalledPin(pin);
                  setCallPickerOpen(false);
                }}
                className="touch-target rounded-lg border-2 py-3 text-xl font-black tabular-nums"
                style={{
                  borderColor: selected ? 'var(--accent)' : 'var(--border)',
                  background: selected
                    ? 'color-mix(in srgb, var(--accent) 18%, var(--surface))'
                    : 'var(--surface)',
                  color: selected ? 'var(--accent)' : 'var(--text)',
                }}
                aria-pressed={selected}
              >
                {pin}
              </button>
            );
          })}
        </div>
        {calledPin != null && (
          <button
            type="button"
            onClick={() => {
              setCalledPin(null);
              setCallPickerOpen(false);
            }}
            className="touch-target mt-3 w-full rounded-lg border px-3 text-sm font-bold"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            {t('match.callYourShotClear')}
          </button>
        )}
      </Modal>

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
              lastFinished.config.players.find(
                p => p.id === lastFinished.winnerId
              )?.name ?? '?'
            }
            ranking={lastFinished.ranking.map(r => {
              const p = lastFinished.config.players.find(
                x => x.id === r.playerId
              );
              return { name: p?.name ?? '?', color: p?.color ?? '#999', ...r };
            })}
            correctPredictors={resolveCorrectPredictors(lastFinished)}
          />
        </>
      )}
    </PageContainer>
  );
}

/**
 * Resolve who got their pre-match prediction right. Returns the display
 * names of predictors who picked the actual winner. Used by the
 * VictoryScreen to give bragging rights to the lucky punters.
 */
function resolveCorrectPredictors(match: {
  predictions?: Record<string, string> | null;
  winnerId: string;
  config: { players: { id: string; name: string }[] };
}): string[] {
  // Legacy matches (saved before the predictions feature) have no
  // `predictions` field; `Object.entries(undefined)` would throw and
  // crash the whole MatchView. Default to empty to keep render safe
  // even if the rehydrate migration somehow missed an entry.
  const predictions = match.predictions ?? {};
  const out: string[] = [];
  for (const [predictorId, pickedId] of Object.entries(predictions)) {
    if (pickedId !== match.winnerId) continue;
    const predictor = match.config.players.find(p => p.id === predictorId);
    if (predictor) out.push(predictor.name);
  }
  return out;
}

interface VictoryScreenProps {
  winnerName: string;
  ranking: {
    name: string;
    color: string;
    finalScore: number;
    eliminated: boolean;
    rank: number;
  }[];
  correctPredictors?: string[];
  onClose: () => void;
  onPlayAgain: () => void;
  onRematch: () => void;
  onHistory: () => void;
}

function VictoryScreen({
  winnerName,
  ranking,
  correctPredictors = [],
  onClose,
  onPlayAgain,
  onRematch,
  onHistory,
}: VictoryScreenProps) {
  const { t, locale } = useI18n();
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await buildShareCard({
        winnerName,
        ranking: ranking.map(r => ({
          rank: r.rank,
          name: r.name,
          color: r.color,
          finalScore: r.finalScore,
          eliminated: r.eliminated,
        })),
        locale,
      });
      if (blob) {
        await shareCard(
          blob,
          `mister-molkky-${new Date().toISOString().slice(0, 10)}.png`,
          t('match.shareText', { name: winnerName })
        );
      }
    } finally {
      setSharing(false);
    }
  };
  return (
    <Modal open onClose={onClose}>
      <div className="mm-victory-pop flex flex-col items-center gap-3 text-center">
        <TrophyIcon size={56} style={{ color: 'var(--accent)' }} />
        <h2 className="m-0 text-2xl font-black">{t('match.victory')}</h2>
        <p className="m-0 text-lg">
          {t('match.victoryMessage', { name: winnerName })}
        </p>
        {correctPredictors.length > 0 && (
          <p
            className="m-0 rounded-full border px-3 py-1 text-xs font-bold"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
          >
            {t('match.predictionsCorrect', {
              names: correctPredictors.join(', '),
            })}
          </p>
        )}
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
            <span
              className="w-6 text-center text-sm font-bold"
              style={{ color: 'var(--muted)' }}
            >
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
          onClick={handleShare}
          disabled={sharing}
          className="touch-target flex items-center justify-center gap-2 rounded-lg border px-4 font-semibold disabled:opacity-50"
          style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
        >
          <ShareIcon size={18} />
          {sharing ? t('common.loading') : t('match.shareCard')}
        </button>
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
          className="touch-target flex items-center justify-center gap-2 rounded-lg px-4 font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          <RematchIcon size={18} />
          {t('match.rematch')}
        </button>
      </div>
    </Modal>
  );
}
