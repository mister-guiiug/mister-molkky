import type { PlayerProgress, MatchOutcome } from './rules';

export interface RankingEntry {
  readonly playerId: string;
  readonly finalScore: number;
  readonly eliminated: boolean;
  readonly hasWon: boolean;
  readonly rank: number;
}

export function buildRanking(
  playerIds: readonly string[],
  outcome: MatchOutcome,
  eliminationOrder: readonly string[] = []
): RankingEntry[] {
  const elimRank = new Map<string, number>();
  eliminationOrder.forEach((id, i) => elimRank.set(id, i));

  const enriched = playerIds.map(id => {
    const p = outcome.progress.get(id);
    return {
      playerId: id,
      finalScore: p?.score ?? 0,
      eliminated: p?.eliminated ?? false,
      hasWon: p?.hasWon ?? false,
      elimIndex: elimRank.get(id) ?? -1,
    };
  });

  const sorted = [...enriched].sort((a, b) => {
    if (a.hasWon && !b.hasWon) return -1;
    if (b.hasWon && !a.hasWon) return 1;
    if (!a.eliminated && b.eliminated) return -1;
    if (a.eliminated && !b.eliminated) return 1;
    if (a.eliminated && b.eliminated) {
      return b.elimIndex - a.elimIndex;
    }
    return b.finalScore - a.finalScore;
  });

  return sorted.map((e, i) => ({
    playerId: e.playerId,
    finalScore: e.finalScore,
    eliminated: e.eliminated,
    hasWon: e.hasWon,
    rank: i + 1,
  }));
}

export function extractProgressList(
  playerIds: readonly string[],
  outcome: MatchOutcome
): PlayerProgress[] {
  return playerIds
    .map(id => outcome.progress.get(id))
    .filter((p): p is PlayerProgress => Boolean(p));
}
