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
  initialScore,
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
  editThrow: (throwId: string, fallenPins: number[]) => boolean;
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
    variant: config.variant ?? 'classic',
  };
}

/**
 * Resolve actor identifiers + player→team map when team mode is active.
 * In solo mode we just use player IDs; in team mode we use team IDs and
 * map each player to their team.
 */
function actorContext(config: MatchConfig): {
  actorIds: string[];
  actorMap?: Map<string, string>;
} {
  if (!config.teams || config.teams.length === 0) {
    return { actorIds: config.players.map(p => p.id) };
  }
  const actorMap = new Map<string, string>();
  for (const team of config.teams) {
    for (const pid of team.playerIds) actorMap.set(pid, team.id);
  }
  return {
    actorIds: config.teams.map(t => t.id),
    actorMap,
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
        const { actorIds, actorMap } = actorContext(state.config);
        const beforeOutcome = replayThrows(
          actorIds,
          state.throws.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
          settings,
          actorMap
        );
        if (beforeOutcome.isOver) {
          return { ok: false, overshoot: false, eliminated: false, won: false };
        }
        const expectedActor = ruleCurrentPlayer(actorIds, beforeOutcome);
        if (!expectedActor) {
          return { ok: false, overshoot: false, eliminated: false, won: false };
        }
        const progress = beforeOutcome.progress.get(expectedActor);
        const currentScore = progress?.score ?? initialScore(settings);
        const evaluation = evaluateThrow(currentScore, fallenPins, settings);

        const isMiss = evaluation.score === 0;
        const willBeEliminated =
          isMiss && (progress?.missStreak ?? 0) + 1 >= settings.maxMisses;

        // Pick the actual player who throws — in solo mode the actor IS
        // the player; in team mode we rotate through the team members
        // based on how many throws the team has already taken.
        const throwingPlayerId = (() => {
          if (!actorMap) return expectedActor;
          const team = state.config.teams.find(tt => tt.id === expectedActor);
          if (!team) return expectedActor;
          const teamThrows = state.throws.filter(
            t => actorMap.get(t.playerId) === expectedActor
          ).length;
          return team.playerIds[teamThrows % team.playerIds.length] ?? expectedActor;
        })();

        const newThrow: Throw = ThrowSchema.parse({
          id: newId(),
          playerId: throwingPlayerId as PlayerId,
          timestamp: Date.now(),
          fallenPins,
          computedScore: evaluation.score,
          resultedInElimination: willBeEliminated,
          resultedInOvershoot: evaluation.overshoot,
        });

        const nextThrows = [...state.throws, newThrow];
        const nextState: CurrentMatchState = { ...state, throws: nextThrows };

        const afterOutcome = replayThrows(
          actorIds,
          nextThrows.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
          settings,
          actorMap
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

      editThrow: (throwId, fallenPins) => {
        const state = get().current;
        if (!state) return false;
        const idx = state.throws.findIndex(t => t.id === throwId);
        if (idx < 0) return false;
        const original = state.throws[idx]!;
        const settings = settingsFromConfig(state.config);
        const { actorIds, actorMap } = actorContext(state.config);

        const updatedThrow: Throw = ThrowSchema.parse({
          ...original,
          fallenPins,
          computedScore:
            fallenPins.length === 0
              ? 0
              : fallenPins.length === 1
                ? fallenPins[0]!
                : fallenPins.length,
        });
        const candidateThrows = [
          ...state.throws.slice(0, idx),
          updatedThrow,
          ...state.throws.slice(idx + 1),
        ];

        try {
          const replay = replayThrows(
            actorIds,
            candidateThrows.map(t => ({
              playerId: t.playerId,
              fallenPins: t.fallenPins,
            })),
            settings,
            actorMap
          );
          const acceptedThrows = candidateThrows.slice(0, replay.currentTurn);
          const reconciled = acceptedThrows.map(t => {
            const actor = actorMap?.get(t.playerId) ?? t.playerId;
            const progress = replay.progress.get(actor);
            return {
              ...t,
              resultedInElimination: progress?.eliminated ?? false,
              resultedInOvershoot: false,
            };
          });
          set({
            current: { ...state, throws: reconciled },
            pendingFeedback: null,
          });
          if (replay.winnerId) {
            get().finishMatch();
          }
          return true;
        } catch {
          return false;
        }
      },

      abandonMatch: () => set({ current: null, pendingFeedback: null }),

      finishMatch: () => {
        const state = get().current;
        if (!state) return null;
        const settings = settingsFromConfig(state.config);
        const { actorIds, actorMap } = actorContext(state.config);
        const outcome = replayThrows(
          actorIds,
          state.throws.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
          settings,
          actorMap
        );
        if (!outcome.winnerId) return null;

        const eliminationOrder: string[] = [];
        let runningElim = new Set<string>();
        for (const t of state.throws) {
          const before = runningElim.size;
          const replay = replayThrows(
            actorIds,
            state.throws
              .slice(0, state.throws.indexOf(t) + 1)
              .map(x => ({ playerId: x.playerId, fallenPins: x.fallenPins })),
            settings,
            actorMap
          );
          for (const [pid, p] of replay.progress) {
            if (p.eliminated && !runningElim.has(pid)) {
              runningElim.add(pid);
              eliminationOrder.push(pid);
            }
          }
          if (runningElim.size === before) continue;
        }
        const ranking = buildRanking(actorIds, outcome, eliminationOrder);

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
  /** When in team mode, the actual member currently throwing (≠ team rep). */
  throwingMember?: Player;
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
  const { actorIds, actorMap } = actorContext(match.config);
  const outcome = replayThrows(
    actorIds,
    match.throws.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
    settings,
    actorMap
  );
  return { playerIds: actorIds, outcome, actorMap };
}

export function useCurrentPlayerInfo(): CurrentPlayerInfo | null {
  const match = useMatchStore(s => s.current);
  return useMemo(() => {
    const result = computeOutcome(match);
    if (!result || !match) return null;
    const id = ruleCurrentPlayer(result.playerIds, result.outcome);
    if (!id) return null;
    const progress = result.outcome.progress.get(id);

    if (result.actorMap) {
      const team = match.config.teams.find(tt => tt.id === id);
      if (!team) return null;
      const teamThrowsSoFar = match.throws.filter(
        t => result.actorMap!.get(t.playerId) === id
      ).length;
      const nextPlayerId =
        team.playerIds[teamThrowsSoFar % team.playerIds.length];
      const throwingMember = match.config.players.find(p => p.id === nextPlayerId);
      const teamAsPlayer: Player = {
        id: team.id as Player['id'],
        name: team.name,
        color: team.color,
        createdAt: 0,
      };
      return {
        player: teamAsPlayer,
        throwingMember,
        score: progress?.score ?? 0,
        missStreak: progress?.missStreak ?? 0,
      };
    }

    const player = match.config.players.find(p => p.id === id);
    if (!player) return null;
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
