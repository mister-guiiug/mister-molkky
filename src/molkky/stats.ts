import type { ThrowRecord } from './rules';
import {
  replayThrows,
  DEFAULT_RULE_SETTINGS,
  type RuleSettings,
} from './rules';

export interface PlayerStats {
  readonly playerId: string;
  matchesPlayed: number;
  matchesWon: number;
  podiums: number;
  totalThrows: number;
  totalPinsHit: number;
  totalScore: number;
  bestStreak: number;
  exactFifties: number;
  overshoots: number;
  pinFrequency: Record<number, number>;
  topPin: number | null;
}

export interface MatchStatsInput {
  readonly playerIds: readonly string[];
  readonly throws: readonly ThrowRecord[];
  readonly winnerId: string | null;
  readonly settings?: RuleSettings;
}

function makeEmptyStats(playerId: string): PlayerStats {
  return {
    playerId,
    matchesPlayed: 0,
    matchesWon: 0,
    podiums: 0,
    totalThrows: 0,
    totalPinsHit: 0,
    totalScore: 0,
    bestStreak: 0,
    exactFifties: 0,
    overshoots: 0,
    pinFrequency: {},
    topPin: null,
  };
}

function pickTopPin(freq: Record<number, number>): number | null {
  let bestPin: number | null = null;
  let bestCount = 0;
  for (const [k, v] of Object.entries(freq)) {
    if (v > bestCount) {
      bestCount = v;
      bestPin = Number(k);
    }
  }
  return bestPin;
}

export function computeStats(
  matches: readonly MatchStatsInput[]
): Map<string, PlayerStats> {
  const all = new Map<string, PlayerStats>();

  for (const match of matches) {
    const settings = match.settings ?? DEFAULT_RULE_SETTINGS;
    const outcome = replayThrows(match.playerIds, match.throws, settings);

    const finalRanking = [...match.playerIds].sort((a, b) => {
      const pa = outcome.progress.get(a);
      const pb = outcome.progress.get(b);
      const sa = pa?.hasWon ? Number.POSITIVE_INFINITY : (pa?.score ?? 0);
      const sb = pb?.hasWon ? Number.POSITIVE_INFINITY : (pb?.score ?? 0);
      return sb - sa;
    });

    for (const pid of match.playerIds) {
      if (!all.has(pid)) all.set(pid, makeEmptyStats(pid));
      const stats = all.get(pid)!;
      const progress = outcome.progress.get(pid);
      if (!progress) continue;

      stats.matchesPlayed += 1;
      stats.totalThrows += progress.totalThrows;
      stats.totalPinsHit += progress.pinsHit;
      stats.totalScore += progress.score;
      if (progress.longestStreak > stats.bestStreak) {
        stats.bestStreak = progress.longestStreak;
      }
      if (progress.hasWon || match.winnerId === pid) {
        stats.matchesWon += 1;
      }
      const rankIndex = finalRanking.indexOf(pid);
      if (rankIndex >= 0 && rankIndex <= 2) {
        stats.podiums += 1;
      }
    }

    const runningScores = new Map<string, number>();
    match.playerIds.forEach(id => runningScores.set(id, 0));
    for (const t of match.throws) {
      const stats = all.get(t.playerId);
      if (!stats) continue;
      if (t.fallenPins.length === 1) {
        const pin = t.fallenPins[0]!;
        stats.pinFrequency[pin] = (stats.pinFrequency[pin] ?? 0) + 1;
      }
      const prev = runningScores.get(t.playerId) ?? 0;
      let delta = 0;
      if (t.fallenPins.length === 0) delta = 0;
      else if (t.fallenPins.length === 1) delta = t.fallenPins[0]!;
      else delta = t.fallenPins.length;
      const next = prev + delta;
      if (delta > 0 && next > settings.targetScore) {
        stats.overshoots += 1;
        runningScores.set(t.playerId, settings.overshootPenalty);
      } else if (next === settings.targetScore) {
        stats.exactFifties += 1;
        runningScores.set(t.playerId, next);
      } else {
        runningScores.set(t.playerId, next);
      }
    }
  }

  for (const stats of all.values()) {
    stats.topPin = pickTopPin(stats.pinFrequency);
  }

  return all;
}

export function winRate(stats: PlayerStats): number {
  if (stats.matchesPlayed === 0) return 0;
  return stats.matchesWon / stats.matchesPlayed;
}

export function accuracy(stats: PlayerStats): number {
  if (stats.totalThrows === 0) return 0;
  return stats.totalPinsHit / stats.totalThrows;
}

export function averageScorePerMatch(stats: PlayerStats): number {
  if (stats.matchesPlayed === 0) return 0;
  return stats.totalScore / stats.matchesPlayed;
}

export function averageScorePerThrow(stats: PlayerStats): number {
  if (stats.totalThrows === 0) return 0;
  return stats.totalScore / stats.totalThrows;
}

export interface HeadToHead {
  sharedMatches: number;
  winsA: number;
  winsB: number;
  avgScoreA: number;
  avgScoreB: number;
  accuracyA: number;
  accuracyB: number;
}

/**
 * Compute pairwise stats restricted to matches where BOTH players took
 * part. Useful for "who beats whom" battle cards.
 */
export interface MatchTimelineEntry {
  /** Original match ID (so the UI can link back). */
  readonly id: string;
  readonly finishedAt: number;
  /** Did the focused player win this match? */
  readonly won: boolean;
}

/**
 * Per-player win-streak summary across all matches they played in. Matches
 * are expected sorted by `finishedAt` ascending — we sort defensively so
 * callers can pass any order.
 *
 * `currentStreak` counts the *most recent* consecutive wins. It's 0 if
 * the last match was a loss (or if the player played zero matches).
 * `bestStreak` is the all-time max consecutive wins.
 */
export interface WinStreak {
  readonly currentStreak: number;
  readonly bestStreak: number;
}

export function computeWinStreak(
  timeline: readonly MatchTimelineEntry[]
): WinStreak {
  if (timeline.length === 0) return { currentStreak: 0, bestStreak: 0 };
  const sorted = [...timeline].sort((a, b) => a.finishedAt - b.finishedAt);
  let best = 0;
  let running = 0;
  for (const t of sorted) {
    if (t.won) {
      running += 1;
      if (running > best) best = running;
    } else {
      running = 0;
    }
  }
  // Walk backwards to compute the *current* trailing streak — it's the
  // number of consecutive wins ending at the most recent match.
  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i]!.won) current += 1;
    else break;
  }
  return { currentStreak: current, bestStreak: best };
}

/**
 * Rolling-window win rate at each point in the player's history. Returns
 * one value per match (oldest → newest), each = winRate over the last
 * `windowSize` matches up to and including that one. Feeds a sparkline
 * trend graph in StatsView. Output values are in [0, 1].
 */
export function computeWinRateTrend(
  timeline: readonly MatchTimelineEntry[],
  windowSize: number
): number[] {
  if (timeline.length === 0 || windowSize <= 0) return [];
  const sorted = [...timeline].sort((a, b) => a.finishedAt - b.finishedAt);
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const start = Math.max(0, i - windowSize + 1);
    const window = sorted.slice(start, i + 1);
    const wins = window.filter(w => w.won).length;
    out.push(wins / window.length);
  }
  return out;
}

export function headToHead(
  matches: readonly MatchStatsInput[],
  playerA: string,
  playerB: string
): HeadToHead {
  let sharedMatches = 0;
  let winsA = 0;
  let winsB = 0;
  let scoreA = 0;
  let scoreB = 0;
  let throwsA = 0;
  let throwsB = 0;
  let pinsHitA = 0;
  let pinsHitB = 0;

  for (const match of matches) {
    if (!match.playerIds.includes(playerA)) continue;
    if (!match.playerIds.includes(playerB)) continue;
    sharedMatches += 1;
    if (match.winnerId === playerA) winsA += 1;
    if (match.winnerId === playerB) winsB += 1;

    const settings = match.settings ?? DEFAULT_RULE_SETTINGS;
    const out = replayThrows(match.playerIds, match.throws, settings);
    scoreA += out.progress.get(playerA)?.score ?? 0;
    scoreB += out.progress.get(playerB)?.score ?? 0;
    throwsA += out.progress.get(playerA)?.totalThrows ?? 0;
    throwsB += out.progress.get(playerB)?.totalThrows ?? 0;
    pinsHitA += out.progress.get(playerA)?.pinsHit ?? 0;
    pinsHitB += out.progress.get(playerB)?.pinsHit ?? 0;
  }

  return {
    sharedMatches,
    winsA,
    winsB,
    avgScoreA: sharedMatches === 0 ? 0 : scoreA / sharedMatches,
    avgScoreB: sharedMatches === 0 ? 0 : scoreB / sharedMatches,
    accuracyA: throwsA === 0 ? 0 : pinsHitA / throwsA,
    accuracyB: throwsB === 0 ? 0 : pinsHitB / throwsB,
  };
}
