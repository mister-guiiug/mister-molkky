import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '../storage';
import {
  CurrentMatchStateSchema,
  FinishedMatchSchema,
  MatchConfigSchema,
  ThrowSchema,
  makeMatchId,
  newId,
  type CurrentMatchState,
  type FinishedMatch,
  type MatchConfig,
  type Player,
  type PlayerId,
  type Throw,
} from '../schemas';
import {
  DEFAULT_RULE_SETTINGS,
  currentPlayer as ruleCurrentPlayer,
  evaluateThrow,
  replayThrows,
  type RuleSettings,
} from '../molkky/rules';
import { buildRanking, type RankingEntry } from '../molkky/ranking';

export type FeedbackEvent = 'throw' | 'overshoot' | 'elimination' | 'victory';

interface MatchStoreState {
  current: CurrentMatchState | null;
  history: FinishedMatch[];
  pendingFeedback: FeedbackEvent | null;

  startMatch: (config: MatchConfig) => void;
  recordThrow: (fallenPins: number[]) => {
    ok: boolean;
    overshoot: boolean;
    eliminated: boolean;
    won: boolean;
  };
  undoLastThrow: () => boolean;
  abandonMatch: () => void;
  finishMatch: () => FinishedMatch | null;
  clearFeedback: () => void;

  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  importBundle: (raw: unknown) => { ok: boolean; error?: string; applied?: number };
}

function settingsFromConfig(config: MatchConfig): RuleSettings {
  return {
    targetScore: config.targetScore,
    overshootPenalty: config.overshootPenalty,
    maxMisses: config.maxMisses,
  };
}

function shufflePlayers(players: Player[]): Player[] {
  const arr = [...players];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function rankingToSchema(entries: RankingEntry[]) {
  return entries.map(e => ({
    playerId: e.playerId as PlayerId,
    finalScore: e.finalScore,
    eliminated: e.eliminated,
    rank: e.rank,
  }));
}

export const useMatchStore = create<MatchStoreState>()(
  persist(
    (set, get) => ({
      current: null,
      history: [],
      pendingFeedback: null,

      startMatch: rawConfig => {
        const config = MatchConfigSchema.parse(rawConfig);
        const players = config.shufflePlayers
          ? shufflePlayers(config.players)
          : config.players;
        const finalConfig: MatchConfig = { ...config, players };
        const current: CurrentMatchState = CurrentMatchStateSchema.parse({
          id: makeMatchId(newId()),
          config: finalConfig,
          throws: [],
          startedAt: Date.now(),
        });
        set({ current, pendingFeedback: null });
      },

      recordThrow: fallenPins => {
        const state = get().current;
        if (!state) return { ok: false, overshoot: false, eliminated: false, won: false };

        const settings = settingsFromConfig(state.config);
        const playerIds = state.config.players.map(p => p.id);
        const beforeOutcome = replayThrows(
          playerIds,
          state.throws.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
          settings
        );
        if (beforeOutcome.isOver) {
          return { ok: false, overshoot: false, eliminated: false, won: false };
        }
        const expected = ruleCurrentPlayer(playerIds, beforeOutcome);
        if (!expected) {
          return { ok: false, overshoot: false, eliminated: false, won: false };
        }
        const progress = beforeOutcome.progress.get(expected);
        const currentScore = progress?.score ?? 0;
        const evaluation = evaluateThrow(currentScore, fallenPins, settings);

        const isMiss = evaluation.score === 0;
        const willBeEliminated =
          isMiss && (progress?.missStreak ?? 0) + 1 >= settings.maxMisses;

        const newThrow: Throw = ThrowSchema.parse({
          id: newId(),
          playerId: expected as PlayerId,
          timestamp: Date.now(),
          fallenPins,
          computedScore: evaluation.score,
          resultedInElimination: willBeEliminated,
          resultedInOvershoot: evaluation.overshoot,
        });

        const nextThrows = [...state.throws, newThrow];
        const nextState: CurrentMatchState = { ...state, throws: nextThrows };

        const afterOutcome = replayThrows(
          playerIds,
          nextThrows.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
          settings
        );

        let feedback: FeedbackEvent = 'throw';
        if (afterOutcome.winnerId) feedback = 'victory';
        else if (willBeEliminated) feedback = 'elimination';
        else if (evaluation.overshoot) feedback = 'overshoot';

        set({ current: nextState, pendingFeedback: feedback });

        if (afterOutcome.winnerId) {
          get().finishMatch();
        }

        return {
          ok: true,
          overshoot: evaluation.overshoot,
          eliminated: willBeEliminated,
          won: Boolean(afterOutcome.winnerId),
        };
      },

      undoLastThrow: () => {
        const state = get().current;
        if (!state || state.throws.length === 0) return false;
        const nextThrows = state.throws.slice(0, -1);
        set({
          current: { ...state, throws: nextThrows },
          pendingFeedback: null,
        });
        return true;
      },

      abandonMatch: () => set({ current: null, pendingFeedback: null }),

      finishMatch: () => {
        const state = get().current;
        if (!state) return null;
        const settings = settingsFromConfig(state.config);
        const playerIds = state.config.players.map(p => p.id);
        const outcome = replayThrows(
          playerIds,
          state.throws.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
          settings
        );
        if (!outcome.winnerId) return null;

        const eliminationOrder: string[] = [];
        let runningElim = new Set<string>();
        for (const t of state.throws) {
          const before = runningElim.size;
          const replay = replayThrows(
            playerIds,
            state.throws
              .slice(0, state.throws.indexOf(t) + 1)
              .map(x => ({ playerId: x.playerId, fallenPins: x.fallenPins })),
            settings
          );
          for (const [pid, p] of replay.progress) {
            if (p.eliminated && !runningElim.has(pid)) {
              runningElim.add(pid);
              eliminationOrder.push(pid);
            }
          }
          if (runningElim.size === before) continue;
        }
        const ranking = buildRanking(playerIds, outcome, eliminationOrder);

        const finished: FinishedMatch = FinishedMatchSchema.parse({
          id: state.id,
          config: state.config,
          throws: state.throws,
          startedAt: state.startedAt,
          finishedAt: Date.now(),
          winnerId: outcome.winnerId,
          ranking: rankingToSchema(ranking),
        });

        set(s => ({
          history: [finished, ...s.history].slice(0, 200),
          current: null,
        }));
        return finished;
      },

      clearFeedback: () => set({ pendingFeedback: null }),

      removeFromHistory: id =>
        set(s => ({ history: s.history.filter(m => m.id !== id) })),

      clearHistory: () => set({ history: [] }),

      importBundle: raw => {
        try {
          const bundle = (raw as { matches?: unknown[] }).matches ?? [];
          const parsed: FinishedMatch[] = [];
          for (const m of bundle) {
            const r = FinishedMatchSchema.safeParse(m);
            if (r.success) parsed.push(r.data);
          }
          if (parsed.length === 0) return { ok: false, error: 'Aucun match valide' };
          set(s => ({
            history: [...parsed, ...s.history].slice(0, 200),
          }));
          return { ok: true, applied: parsed.length };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    }),
    {
      name: 'mm_match',
      storage: createJSONStorage(() => safeLocalStorage()),
      version: 1,
      partialize: state => ({
        current: state.current,
        history: state.history,
      }),
    }
  )
);

export interface ScoreSnapshot {
  score: number;
  missStreak: number;
  eliminated: boolean;
  hasWon: boolean;
}

export interface CurrentPlayerInfo {
  player: Player;
  score: number;
  missStreak: number;
}

/**
 * Compute the cached match outcome from a CurrentMatchState. Pure function;
 * callers wrap it in useMemo keyed on the state ref so React's
 * useSyncExternalStore never sees a "new" snapshot for unchanged state — a
 * fresh object on every getSnapshot call would trip React error #185
 * (Maximum update depth exceeded).
 */
function computeOutcome(match: CurrentMatchState | null) {
  if (!match) return null;
  const settings = settingsFromConfig(match.config);
  const playerIds = match.config.players.map(p => p.id);
  const outcome = replayThrows(
    playerIds,
    match.throws.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
    settings
  );
  return { playerIds, outcome };
}

export function useCurrentPlayerInfo(): CurrentPlayerInfo | null {
  const match = useMatchStore(s => s.current);
  return useMemo(() => {
    const result = computeOutcome(match);
    if (!result || !match) return null;
    const id = ruleCurrentPlayer(result.playerIds, result.outcome);
    if (!id) return null;
    const player = match.config.players.find(p => p.id === id);
    if (!player) return null;
    const progress = result.outcome.progress.get(id);
    return {
      player,
      score: progress?.score ?? 0,
      missStreak: progress?.missStreak ?? 0,
    };
  }, [match]);
}

export function useScores(): Map<string, ScoreSnapshot> {
  const match = useMatchStore(s => s.current);
  return useMemo(() => {
    const map = new Map<string, ScoreSnapshot>();
    const result = computeOutcome(match);
    if (!result) return map;
    for (const [id, p] of result.outcome.progress) {
      map.set(id, {
        score: p.score,
        missStreak: p.missStreak,
        eliminated: p.eliminated,
        hasWon: p.hasWon,
      });
    }
    return map;
  }, [match]);
}

export { DEFAULT_RULE_SETTINGS };
