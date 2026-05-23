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

export interface RuleSettings {
  readonly targetScore: number;
  readonly overshootPenalty: number;
  readonly maxMisses: number;
}

export const DEFAULT_RULE_SETTINGS: RuleSettings = {
  targetScore: DEFAULT_TARGET_SCORE,
  overshootPenalty: DEFAULT_OVERSHOOT_PENALTY,
  maxMisses: DEFAULT_MAX_MISSES,
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

export function evaluateThrow(
  currentScore: number,
  fallenPins: readonly number[],
  settings: RuleSettings = DEFAULT_RULE_SETTINGS
): ThrowEvaluation {
  const score = scoreForThrow(fallenPins);
  const projected = currentScore + score;
  if (projected > settings.targetScore && score > 0) {
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

function makeInitialProgress(playerId: string): PlayerProgress {
  return {
    playerId,
    score: 0,
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
 * Replay a list of throws against a list of players (in turn order) and
 * return the resulting state. Throws after a match win are ignored.
 */
export function replayThrows(
  playerIds: readonly string[],
  throws: readonly ThrowRecord[],
  settings: RuleSettings = DEFAULT_RULE_SETTINGS
): MatchOutcome {
  if (playerIds.length < 2) {
    throw new Error('A Mölkky match needs at least 2 players');
  }

  const progress = new Map<string, PlayerProgress>();
  for (const id of playerIds) progress.set(id, makeInitialProgress(id));

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

  for (const t of throws) {
    if (winnerId) break;
    advanceCursorPastEliminated();
    if (!playerIds.some(isActive)) break;

    const expectedPlayer = playerIds[cursor]!;
    if (t.playerId !== expectedPlayer) {
      throw new Error(
        `Throw out of order: expected ${expectedPlayer}, got ${t.playerId}`
      );
    }

    const player = progress.get(t.playerId)!;
    const evaluation = evaluateThrow(player.score, t.fallenPins, settings);
    player.totalThrows += 1;
    player.pinsHit += t.fallenPins.length;
    player.score = evaluation.nextScore;

    if (evaluation.score === 0) {
      player.missStreak += 1;
      player.consecutiveScoringHits = 0;
      if (player.missStreak >= settings.maxMisses) {
        player.eliminated = true;
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

export function isValidThrow(
  fallenPins: readonly number[]
): boolean {
  if (!Array.isArray(fallenPins)) return false;
  const seen = new Set<number>();
  for (const p of fallenPins) {
    if (!Number.isInteger(p) || p < 1 || p > 12) return false;
    if (seen.has(p)) return false;
    seen.add(p);
  }
  return true;
}
