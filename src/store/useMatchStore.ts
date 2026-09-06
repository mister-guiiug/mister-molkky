import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { keepValid, STORE_KEYS, versionedPersistStorage } from './persistence';
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
import { createLogger } from '@mister-guiiug/dev-pwa-config/logger';

const log = createLogger('store');

export type FeedbackEvent = 'throw' | 'overshoot' | 'elimination' | 'victory';

interface MatchStoreState {
  current: CurrentMatchState | null;
  history: FinishedMatch[];
  pendingFeedback: FeedbackEvent | null;

  startMatch: (config: MatchConfig) => void;
  recordThrow: (
    fallenPins: number[],
    options?: { calledPin?: number }
  ) => {
    ok: boolean;
    overshoot: boolean;
    eliminated: boolean;
    won: boolean;
  };
  undoLastThrow: () => boolean;
  editThrow: (throwId: string, fallenPins: number[]) => boolean;
  abandonMatch: () => void;
  /** Stop the live chrono (e.g. a break). No-op if already paused. */
  pauseChrono: () => void;
  /**
   * Resume the live chrono, folding the just-elapsed pause into
   * pausedTotalMs so the displayed duration excludes paused time. No-op
   * if not paused.
   */
  resumeChrono: () => void;
  /**
   * Mark a single actor (player ID in solo, team ID in team mode) as having
   * forfeited the match. They're treated as eliminated for ranking + turn
   * rotation. If only one active actor remains, the match auto-finishes
   * with that actor as the winner.
   */
  forfeitActor: (actorId: string) => void;
  /**
   * Toggle a star on a throw (by id). Stored as a string[] so the same
   * highlight survives undo/edit-by-id round-trips. No-op if the id is
   * unknown.
   */
  toggleHighlight: (throwId: string) => void;
  /**
   * Record a pre-match prediction: predictorId says they think
   * pickedWinnerId will win. Both must be valid player IDs in the
   * current match. Passing pickedWinnerId === '' clears the prediction.
   */
  setPrediction: (predictorId: string, pickedWinnerId: string) => void;
  finishMatch: () => FinishedMatch | null;
  clearFeedback: () => void;

  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  importBundle: (raw: unknown) => {
    ok: boolean;
    error?: string;
    applied?: number;
  };
}

function settingsFromConfig(config: MatchConfig): RuleSettings {
  return {
    targetScore: config.targetScore,
    overshootPenalty: config.overshootPenalty,
    maxMisses: config.maxMisses,
    variant: config.variant ?? 'classic',
    missSanction: config.missSanction ?? 'elimination',
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
  handicaps: Map<string, number>;
} {
  const handicaps = new Map<string, number>(
    Object.entries(config.handicaps ?? {})
  );
  if (!config.teams || config.teams.length === 0) {
    return { actorIds: config.players.map(p => p.id), handicaps };
  }
  const actorMap = new Map<string, string>();
  for (const team of config.teams) {
    for (const pid of team.playerIds) actorMap.set(pid, team.id);
  }
  return {
    actorIds: config.teams.map(t => t.id),
    actorMap,
    handicaps,
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

/** Ce que ce magasin écrit sur le disque (voir `partialize`). */
interface PersistedMatch {
  current: CurrentMatchState | null;
  history: FinishedMatch[];
}

/**
 * L'ANCIENNE chaîne de migrations de `zustand/persist` (v0 → v3), devenue le
 * `legacy` du magasin versionné.
 *
 * Elle rétro-remplit les champs ajoutés au fil des fonctionnalités :
 * `forfeitedActorIds` / `highlightedThrowIds` / `predictions` (v2), puis
 * `pausedAt` / `pausedTotalMs` (v3). Elle est IDEMPOTENTE — chaque champ n'est
 * posé que s'il manque — donc la rejouer sur une donnée déjà à jour ne coûte
 * rien, et c'est ce qui permet de l'appliquer sans consulter le numéro.
 *
 * Le `_migratedFrom: version` qu'elle ajoutait à l'état a disparu : personne ne
 * l'a jamais lu, et la validation par schéma le retirerait de toute façon.
 */
function backfillMatchFields(persistedState: unknown): unknown {
  if (!persistedState || typeof persistedState !== 'object') {
    return persistedState;
  }
  const s = persistedState as {
    current?: Record<string, unknown> | null;
    history?: Record<string, unknown>[];
  };
  const fillCurrent = (m: Record<string, unknown> | null | undefined) => {
    if (!m) return m ?? null;
    return {
      ...m,
      forfeitedActorIds: Array.isArray(m.forfeitedActorIds)
        ? m.forfeitedActorIds
        : [],
      highlightedThrowIds: Array.isArray(m.highlightedThrowIds)
        ? m.highlightedThrowIds
        : [],
      predictions:
        m.predictions && typeof m.predictions === 'object' ? m.predictions : {},
      pausedAt: typeof m.pausedAt === 'number' ? m.pausedAt : null,
      pausedTotalMs: typeof m.pausedTotalMs === 'number' ? m.pausedTotalMs : 0,
    };
  };
  const fillFinished = (m: Record<string, unknown>) => ({
    ...m,
    highlightedThrowIds: Array.isArray(m.highlightedThrowIds)
      ? m.highlightedThrowIds
      : [],
    predictions:
      m.predictions && typeof m.predictions === 'object' ? m.predictions : {},
  });
  return {
    ...s,
    current: fillCurrent(s.current),
    history: Array.isArray(s.history) ? s.history.map(fillFinished) : [],
  };
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
          forfeitedActorIds: [],
          highlightedThrowIds: [],
          predictions: {},
        });
        set({ current, pendingFeedback: null });
      },

      recordThrow: (fallenPins, options) => {
        const state = get().current;
        if (!state)
          return { ok: false, overshoot: false, eliminated: false, won: false };

        const settings = settingsFromConfig(state.config);
        const { actorIds, actorMap, handicaps } = actorContext(state.config);
        const forfeited = state.forfeitedActorIds;
        const beforeOutcome = replayThrows(
          actorIds,
          state.throws.map(t => ({
            playerId: t.playerId,
            fallenPins: t.fallenPins,
          })),
          settings,
          actorMap,
          forfeited,
          handicaps
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
          return (
            team.playerIds[teamThrows % team.playerIds.length] ?? expectedActor
          );
        })();

        const newThrow: Throw = ThrowSchema.parse({
          id: newId(),
          playerId: throwingPlayerId as PlayerId,
          timestamp: Date.now(),
          fallenPins,
          computedScore: evaluation.score,
          resultedInElimination: willBeEliminated,
          resultedInOvershoot: evaluation.overshoot,
          ...(options?.calledPin ? { calledPin: options.calledPin } : {}),
        });

        const nextThrows = [...state.throws, newThrow];
        // Recording a throw means play has resumed — auto-fold any open
        // pause into pausedTotalMs so the chrono never counts a break
        // during which the game actually continued.
        const resumed =
          state.pausedAt != null
            ? {
                pausedAt: null,
                pausedTotalMs:
                  (state.pausedTotalMs ?? 0) + (Date.now() - state.pausedAt),
              }
            : {};
        const nextState: CurrentMatchState = {
          ...state,
          ...resumed,
          throws: nextThrows,
        };

        const afterOutcome = replayThrows(
          actorIds,
          nextThrows.map(t => ({
            playerId: t.playerId,
            fallenPins: t.fallenPins,
          })),
          settings,
          actorMap,
          forfeited,
          handicaps
        );

        let feedback: FeedbackEvent = 'throw';
        if (afterOutcome.winnerId) feedback = 'victory';
        else if (willBeEliminated) feedback = 'elimination';
        else if (evaluation.overshoot) feedback = 'overshoot';

        set({ current: nextState, pendingFeedback: feedback });

        if (afterOutcome.winnerId) {
          try {
            get().finishMatch();
          } catch (err) {
            // Surface the error in the console so a bad ranking
            // computation doesn't silently freeze the victory flow.

            log.error('[match] finishMatch failed:', { error: err });
          }
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
        const { actorIds, actorMap, handicaps } = actorContext(state.config);

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
            actorMap,
            state.forfeitedActorIds,
            handicaps
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

      pauseChrono: () => {
        const state = get().current;
        if (!state || state.pausedAt != null) return;
        set({ current: { ...state, pausedAt: Date.now() } });
      },

      resumeChrono: () => {
        const state = get().current;
        if (!state || state.pausedAt == null) return;
        const accumulated =
          (state.pausedTotalMs ?? 0) + (Date.now() - state.pausedAt);
        set({
          current: { ...state, pausedAt: null, pausedTotalMs: accumulated },
        });
      },

      toggleHighlight: throwId => {
        const state = get().current;
        if (!state) return;
        if (!state.throws.some(t => t.id === throwId)) return;
        // Defensive ?? [] — even though migrate() backfills this on
        // rehydrate, a stale in-memory state from before the migration
        // ran would otherwise crash here.
        const existing = state.highlightedThrowIds ?? [];
        const has = existing.includes(throwId);
        const next = has
          ? existing.filter(id => id !== throwId)
          : [...existing, throwId];
        set({ current: { ...state, highlightedThrowIds: next } });
      },

      setPrediction: (predictorId, pickedWinnerId) => {
        const state = get().current;
        if (!state) return;
        const knownIds = new Set(state.config.players.map(p => p.id));
        if (!knownIds.has(predictorId as PlayerId)) return;
        // Same rationale as toggleHighlight — protect against pre-v2
        // in-memory state where predictions might be missing.
        const next = { ...(state.predictions ?? {}) };
        if (pickedWinnerId === '') {
          delete next[predictorId];
        } else if (knownIds.has(pickedWinnerId as PlayerId)) {
          next[predictorId] = pickedWinnerId;
        } else {
          return;
        }
        set({ current: { ...state, predictions: next } });
      },

      forfeitActor: actorId => {
        const state = get().current;
        if (!state) return;
        if (state.forfeitedActorIds.includes(actorId)) return;
        const { actorIds, actorMap, handicaps } = actorContext(state.config);
        if (!actorIds.includes(actorId)) return;

        const nextForfeited = [...state.forfeitedActorIds, actorId];
        const nextState: CurrentMatchState = {
          ...state,
          forfeitedActorIds: nextForfeited,
        };
        set({ current: nextState, pendingFeedback: null });

        // If the forfeit leaves a single active actor, auto-finish so the
        // user lands on the victory screen instead of an empty match.
        const settings = settingsFromConfig(state.config);
        const outcome = replayThrows(
          actorIds,
          state.throws.map(t => ({
            playerId: t.playerId,
            fallenPins: t.fallenPins,
          })),
          settings,
          actorMap,
          nextForfeited,
          handicaps
        );
        if (outcome.winnerId) {
          try {
            get().finishMatch();
          } catch (err) {
            log.error('[match] finishMatch after forfeit failed:', {
              error: err,
            });
          }
        }
      },

      finishMatch: () => {
        const state = get().current;
        if (!state) return null;
        const settings = settingsFromConfig(state.config);
        const { actorIds, actorMap, handicaps } = actorContext(state.config);
        const forfeited = state.forfeitedActorIds;
        const outcome = replayThrows(
          actorIds,
          state.throws.map(t => ({
            playerId: t.playerId,
            fallenPins: t.fallenPins,
          })),
          settings,
          actorMap,
          forfeited,
          handicaps
        );
        if (!outcome.winnerId) return null;

        // Walk forward in the throws and replay 1..n at each step to
        // detect the order in which actors were eliminated. Using the
        // loop index (instead of state.throws.indexOf) keeps this O(n²)
        // rather than O(n³) — matters once a match goes long.
        const eliminationOrder: string[] = [];
        const runningElim = new Set<string>();
        // Forfeited actors are eliminated from the moment they tap; seed
        // them at the front of the elimination order so ranking places
        // them with the other dropouts.
        for (const fid of forfeited) {
          if (!runningElim.has(fid)) {
            runningElim.add(fid);
            eliminationOrder.push(fid);
          }
        }
        for (let i = 0; i < state.throws.length; i += 1) {
          const replay = replayThrows(
            actorIds,
            state.throws
              .slice(0, i + 1)
              .map(x => ({ playerId: x.playerId, fallenPins: x.fallenPins })),
            settings,
            actorMap,
            forfeited,
            handicaps
          );
          for (const [pid, p] of replay.progress) {
            if (p.eliminated && !runningElim.has(pid)) {
              runningElim.add(pid);
              eliminationOrder.push(pid);
            }
          }
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
          highlightedThrowIds: state.highlightedThrowIds,
          predictions: state.predictions,
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
          if (parsed.length === 0)
            return { ok: false, error: 'Aucun match valide' };
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
      name: STORE_KEYS.match,
      // Un seul compteur : celui de l'enveloppe du socle (voir
      // src/store/persistence.ts). `version` / `migrate` de `zustand/persist`
      // ne sont plus posés ici — l'ancienne chaîne 0→3 vit dans `legacy`.
      storage: versionedPersistStorage<PersistedMatch>({
        name: STORE_KEYS.match,
        legacy: backfillMatchFields,
        validate: (data, reject) => {
          if (data === null || typeof data !== 'object') {
            throw new Error('mm_match: forme inattendue');
          }
          const s = data as { current?: unknown; history?: unknown };
          let current: CurrentMatchState | null = null;
          if (s.current !== null && s.current !== undefined) {
            const parsed = CurrentMatchStateSchema.safeParse(s.current);
            if (parsed.success) current = parsed.data;
            else reject(s.current);
          }
          return {
            current,
            // Élément par élément : une partie mal formée ne coûte pas les
            // cent quatre-vingt-dix-neuf autres.
            history: keepValid(FinishedMatchSchema, s.history, reject),
          };
        },
      }),
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
  const { actorIds, actorMap, handicaps } = actorContext(match.config);
  const outcome = replayThrows(
    actorIds,
    match.throws.map(t => ({ playerId: t.playerId, fallenPins: t.fallenPins })),
    settings,
    actorMap,
    match.forfeitedActorIds,
    handicaps
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
      const throwingMember = match.config.players.find(
        p => p.id === nextPlayerId
      );
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

/**
 * Per-actor running score after each of their throws — feeds the live
 * sparkline in MatchView. Computed in a single linear pass over throws so
 * it stays cheap even with long matches.
 */
export function useScoreHistories(): Map<string, number[]> {
  const match = useMatchStore(s => s.current);
  return useMemo(() => {
    const histories = new Map<string, number[]>();
    if (!match) return histories;
    const settings = settingsFromConfig(match.config);
    const { actorIds, actorMap, handicaps } = actorContext(match.config);
    const baseStart = initialScore(settings);
    const variant = settings.variant ?? 'classic';
    // Mirror the handicap math from rules.ts so the sparkline lines up
    // with the scoreboard.
    const startFor = (id: string): number => {
      const h = handicaps.get(id) ?? 0;
      if (h === 0) return baseStart;
      if (variant === 'inverse') return Math.max(1, baseStart - h);
      return Math.min(settings.targetScore - 1, baseStart + h);
    };
    for (const id of actorIds) histories.set(id, [startFor(id)]);

    const running = new Map<string, number>();
    for (const id of actorIds) running.set(id, startFor(id));

    for (const t of match.throws) {
      const actor = actorMap?.get(t.playerId) ?? t.playerId;
      const prev = running.get(actor) ?? baseStart;
      const e = evaluateThrow(prev, t.fallenPins, settings);
      running.set(actor, e.nextScore);
      histories.get(actor)?.push(e.nextScore);
    }
    return histories;
  }, [match]);
}

export { DEFAULT_RULE_SETTINGS };
