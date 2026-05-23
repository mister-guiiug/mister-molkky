/**
 * Mölkky game rules — pure functions, no React, no IO.
 *
 * Reference: https://molkky.com — Fédération Internationale Mölkky.
 *
 * The single source of truth for a match is the ordered list of throws.
 * Every derived value (player scores, current turn, eliminations, winner)
 * is recomputed from that list. This makes undo trivial: drop the last
 * throw and recompute. It also keeps the rules unit-testable in isolation.
 */

export const DEFAULT_TARGET_SCORE = 50;
export const DEFAULT_OVERSHOOT_PENALTY = 25;
export const DEFAULT_MAX_MISSES = 3;

export type RuleVariant = 'classic' | 'inverse' | 'free';

/**
 * What happens when a player hits `maxMisses` consecutive misses.
 * - 'elimination' is the Mölkky standard rule.
 * - 'reset' lets the player keep playing but wipes their score (great for
 *   casual / kids' games where elimination is harsh).
 * - 'none' keeps counting the streak (still shown in the UI) but never
 *   penalises — useful for free practice sessions.
 */
export type MissSanction = 'elimination' | 'reset' | 'none';

export interface RuleSettings {
  readonly targetScore: number;
  readonly overshootPenalty: number;
  readonly maxMisses: number;
  readonly variant?: RuleVariant;
  readonly missSanction?: MissSanction;
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  targetScore: DEFAULT_TARGET_SCORE,
  overshootPenalty: DEFAULT_OVERSHOOT_PENALTY,
  maxMisses: DEFAULT_MAX_MISSES,
  variant: 'classic',
  missSanction: 'elimination',
};

export interface ThrowRecord {
  readonly playerId: string;
  readonly fallenPins: readonly number[];
}

export interface PlayerProgress {
  readonly playerId: string;
  score: number;
  missStreak: number;
  eliminated: boolean;
  hasWon: boolean;
  consecutiveScoringHits: number;
  longestStreak: number;
  totalThrows: number;
  pinsHit: number;
}

export interface MatchOutcome {
  readonly progress: ReadonlyMap<string, PlayerProgress>;
  readonly winnerId: string | null;
  readonly currentPlayerIndex: number;
  readonly currentTurn: number;
  readonly isOver: boolean;
}

export interface ThrowEvaluation {
  readonly score: number;
  readonly nextScore: number;
  readonly overshoot: boolean;
  readonly wonThisThrow: boolean;
  readonly eliminatedThisThrow: boolean;
}

export function scoreForThrow(fallenPins: readonly number[]): number {
  if (fallenPins.length === 0) return 0;
  if (fallenPins.length === 1) {
    const v = fallenPins[0]!;
    if (!Number.isInteger(v) || v < 1 || v > 12) {
      throw new Error(`Invalid pin number: ${String(v)}`);
    }
    return v;
  }
  for (const v of fallenPins) {
    if (!Number.isInteger(v) || v < 1 || v > 12) {
      throw new Error(`Invalid pin number: ${String(v)}`);
    }
  }
  return fallenPins.length;
}

/**
 * Starting score for a given variant. Inverse mode starts each actor at
 * targetScore and counts down to 0.
 */
export function initialScore(settings: RuleSettings): number {
  return settings.variant === 'inverse' ? settings.targetScore : 0;
}

export function evaluateThrow(
  currentScore: number,
  fallenPins: readonly number[],
  settings: RuleSettings = DEFAULT_RULE_SETTINGS
): ThrowEvaluation {
  const score = scoreForThrow(fallenPins);
  const variant = settings.variant ?? 'classic';

  if (variant === 'inverse') {
    const projected = currentScore - score;
    if (projected < 0 && score > 0) {
      return {
        score,
        nextScore: Math.min(
          settings.targetScore,
          currentScore + Math.min(5, settings.overshootPenalty)
        ),
        overshoot: true,
        wonThisThrow: false,
        eliminatedThisThrow: false,
      };
    }
    return {
      score,
      nextScore: projected,
      overshoot: false,
      wonThisThrow: projected === 0,
      eliminatedThisThrow: false,
    };
  }

  const projected = currentScore + score;
  if (projected > settings.targetScore && score > 0) {
    if (variant === 'free') {
      return {
        score,
        nextScore: currentScore,
        overshoot: true,
        wonThisThrow: false,
        eliminatedThisThrow: false,
      };
    }
    return {
      score,
      nextScore: settings.overshootPenalty,
      overshoot: true,
      wonThisThrow: false,
      eliminatedThisThrow: false,
    };
  }
  return {
    score,
    nextScore: projected,
    overshoot: false,
    wonThisThrow: projected === settings.targetScore,
    eliminatedThisThrow: false,
  };
}

function makeInitialProgress(
  playerId: string,
  startScore: number
): PlayerProgress {
  return {
    playerId,
    score: startScore,
    missStreak: 0,
    eliminated: false,
    hasWon: false,
    consecutiveScoringHits: 0,
    longestStreak: 0,
    totalThrows: 0,
    pinsHit: 0,
  };
}

/**
 * Replay a list of throws against a list of actors (in turn order) and
 * return the resulting state. Throws after a match win are ignored.
 *
 * `actorMap` is optional; when provided, the throw's playerId is mapped to
 * its actor (e.g. a team id). Throws are still recorded against the
 * resolved actor, allowing team mode to share score buckets between
 * multiple players.
 *
 * `forfeitedIds` lists actors who tapped "Abandonner" mid-match. They're
 * pre-flagged as eliminated so turn rotation skips them and the ranking
 * places them with the other eliminated actors.
 */
export function replayThrows(
  playerIds: readonly string[],
  throws: readonly ThrowRecord[],
  settings: RuleSettings = DEFAULT_RULE_SETTINGS,
  actorMap?: ReadonlyMap<string, string>,
  forfeitedIds: ReadonlyArray<string> = []
): MatchOutcome {
  if (playerIds.length < 2) {
    throw new Error('A Mölkky match needs at least 2 players');
  }

  const start = initialScore(settings);
  const sanction = settings.missSanction ?? 'elimination';
  const forfeitSet = new Set(forfeitedIds);

  const progress = new Map<string, PlayerProgress>();
  for (const id of playerIds) {
    const p = makeInitialProgress(id, start);
    if (forfeitSet.has(id)) p.eliminated = true;
    progress.set(id, p);
  }

  let winnerId: string | null = null;
  let cursor = 0;

  const isActive = (id: string): boolean => {
    const p = progress.get(id);
    return Boolean(p && !p.eliminated && !p.hasWon);
  };

  const advanceCursorPastEliminated = (): void => {
    let safety = 0;
    while (!isActive(playerIds[cursor]!) && safety < playerIds.length) {
      cursor = (cursor + 1) % playerIds.length;
      safety += 1;
    }
  };

  const resolveActor = (rawId: string): string => actorMap?.get(rawId) ?? rawId;

  for (const t of throws) {
    if (winnerId) break;
    advanceCursorPastEliminated();
    if (!playerIds.some(isActive)) break;

    const expectedActor = playerIds[cursor]!;
    const actor = resolveActor(t.playerId);
    if (actor !== expectedActor) {
      throw new Error(
        `Throw out of order: expected ${expectedActor}, got ${actor}`
      );
    }

    const player = progress.get(actor)!;
    const evaluation = evaluateThrow(player.score, t.fallenPins, settings);
    player.totalThrows += 1;
    player.pinsHit += t.fallenPins.length;
    player.score = evaluation.nextScore;

    if (evaluation.score === 0) {
      player.missStreak += 1;
      player.consecutiveScoringHits = 0;
      if (player.missStreak >= settings.maxMisses) {
        if (sanction === 'elimination') {
          player.eliminated = true;
        } else if (sanction === 'reset') {
          // Wipe the score back to the variant's starting value and
          // clear the streak so the player gets a fresh window.
          player.score = start;
          player.missStreak = 0;
        }
        // 'none' → keep the streak ticking but apply no penalty.
      }
    } else {
      player.missStreak = 0;
      player.consecutiveScoringHits += 1;
      if (player.consecutiveScoringHits > player.longestStreak) {
        player.longestStreak = player.consecutiveScoringHits;
      }
    }

    if (evaluation.wonThisThrow) {
      player.hasWon = true;
      winnerId = player.playerId;
      break;
    }

    const stillActive = playerIds.filter(isActive);
    if (stillActive.length === 1) {
      const lastStanding = progress.get(stillActive[0]!)!;
      lastStanding.hasWon = true;
      winnerId = lastStanding.playerId;
      break;
    }
    if (stillActive.length === 0) break;

    cursor = (cursor + 1) % playerIds.length;
    advanceCursorPastEliminated();
  }

  const activeOrdered = playerIds.filter(isActive);
  let currentPlayerIndex = 0;
  if (activeOrdered.length > 0) {
    advanceCursorPastEliminated();
    const id = playerIds[cursor]!;
    currentPlayerIndex = Math.max(0, activeOrdered.indexOf(id));
  }
  return {
    progress,
    winnerId,
    currentPlayerIndex,
    currentTurn: throws.length,
    isOver: winnerId !== null,
  };
}

export function currentPlayer(
  playerIds: readonly string[],
  outcome: MatchOutcome
): string | null {
  if (outcome.isOver) return null;
  const alive = playerIds.filter(id => {
    const p = outcome.progress.get(id);
    return p && !p.eliminated && !p.hasWon;
  });
  if (alive.length === 0) return null;
  return alive[outcome.currentPlayerIndex % alive.length]!;
}

/**
 * Strategy hint returned by the in-match Coach. Pure derivation from the
 * current score + rule settings — no state, no React.
 */
export interface CoachSuggestion {
  /** Single pin number (1..12) that brings the actor exactly to the target. */
  readonly bestSinglePin: number | null;
  /** Number of pins (2..12) whose multi-hit lands exactly on the target. */
  readonly bestMultiCount: number | null;
  /** Single pin numbers that would trigger an overshoot if hit alone. */
  readonly avoidSingles: readonly number[];
}

/**
 * Compute the optimal throw for the given current score under the active
 * rule settings. Used by the in-match coach widget.
 *
 * - Classic / free: player adds to score, target = settings.targetScore.
 * - Inverse: player subtracts from score, target = 0.
 *
 * If neither a single-pin nor a multi-pin hit can reach the target in
 * one throw, both `bestSinglePin` and `bestMultiCount` return null and
 * the caller should fall back to "pick anything safe".
 */
export function suggestThrow(
  currentScore: number,
  settings: RuleSettings = DEFAULT_RULE_SETTINGS
): CoachSuggestion {
  const variant = settings.variant ?? 'classic';

  if (variant === 'inverse') {
    const single =
      currentScore >= 1 && currentScore <= 12 ? currentScore : null;
    const multi = currentScore >= 2 && currentScore <= 12 ? currentScore : null;
    const avoid: number[] = [];
    for (let p = 1; p <= 12; p += 1) {
      if (p > currentScore) avoid.push(p);
    }
    return {
      bestSinglePin: single,
      bestMultiCount: multi,
      avoidSingles: avoid,
    };
  }

  const need = settings.targetScore - currentScore;
  const single = need >= 1 && need <= 12 ? need : null;
  const multi = need >= 2 && need <= 12 ? need : null;
  const avoid: number[] = [];
  for (let p = 1; p <= 12; p += 1) {
    if (currentScore + p > settings.targetScore) avoid.push(p);
  }
  return {
    bestSinglePin: single,
    bestMultiCount: multi,
    avoidSingles: avoid,
  };
}

export function isValidThrow(fallenPins: readonly number[]): boolean {
  if (!Array.isArray(fallenPins)) return false;
  const seen = new Set<number>();
  for (const p of fallenPins) {
    if (!Number.isInteger(p) || p < 1 || p > 12) return false;
    if (seen.has(p)) return false;
    seen.add(p);
  }
  return true;
}
