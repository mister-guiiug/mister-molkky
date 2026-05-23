import type { ThrowRecord } from './rules';
import { replayThrows, DEFAULT_RULE_SETTINGS, type RuleSettings } from './rules';

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

export function computeStats(matches: readonly MatchStatsInput[]): Map<
  string,
  PlayerStats
> {
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

    let runningScores = new Map<string, number>();
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
