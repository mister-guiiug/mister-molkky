import { describe, expect, it } from 'vitest';
import {
  accuracy,
  averageScorePerMatch,
  averageScorePerThrow,
  computeStats,
  winRate,
  type MatchStatsInput,
} from './stats';

const matches: MatchStatsInput[] = [
  {
    playerIds: ['a', 'b'],
    throws: [
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [2] },
    ],
    winnerId: 'a',
  },
  {
    playerIds: ['a', 'b'],
    throws: [
      { playerId: 'a', fallenPins: [] },
      { playerId: 'b', fallenPins: [5] },
      { playerId: 'a', fallenPins: [] },
      { playerId: 'b', fallenPins: [5] },
      { playerId: 'a', fallenPins: [] },
    ],
    winnerId: 'b',
  },
];

describe('computeStats', () => {
  const stats = computeStats(matches);

  it('counts matches played and won', () => {
    expect(stats.get('a')?.matchesPlayed).toBe(2);
    expect(stats.get('a')?.matchesWon).toBe(1);
    expect(stats.get('b')?.matchesWon).toBe(1);
  });

  it('counts exact-fifty victories', () => {
    expect(stats.get('a')?.exactFifties).toBe(1);
  });

  it('counts pins hit and total throws', () => {
    expect(stats.get('a')?.totalThrows).toBe(8);
    expect(stats.get('a')?.totalPinsHit).toBeGreaterThanOrEqual(5);
  });

  it('tracks pin frequency for single-pin hits', () => {
    expect(stats.get('a')?.pinFrequency[12]).toBe(4);
    expect(stats.get('a')?.topPin).toBe(12);
    expect(stats.get('b')?.pinFrequency[1]).toBeGreaterThan(0);
  });

  it('tracks longest scoring streak', () => {
    expect(stats.get('a')?.bestStreak).toBeGreaterThanOrEqual(4);
  });
});

describe('derived metrics', () => {
  const stats = computeStats(matches);

  it('win rate', () => {
    expect(winRate(stats.get('a')!)).toBe(0.5);
    expect(winRate(stats.get('b')!)).toBe(0.5);
  });

  it('accuracy (pinsHit / totalThrows)', () => {
    const a = stats.get('a')!;
    expect(accuracy(a)).toBeGreaterThan(0);
    expect(accuracy(a)).toBeLessThanOrEqual(12);
  });

  it('avg score per match', () => {
    expect(averageScorePerMatch(stats.get('a')!)).toBeGreaterThan(0);
  });

  it('avg score per throw', () => {
    expect(averageScorePerThrow(stats.get('a')!)).toBeGreaterThan(0);
  });

  it('returns 0 for empty stats', () => {
    const empty = {
      playerId: 'x',
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
    expect(winRate(empty)).toBe(0);
    expect(accuracy(empty)).toBe(0);
    expect(averageScorePerMatch(empty)).toBe(0);
    expect(averageScorePerThrow(empty)).toBe(0);
  });
});

describe('computeStats — overshoots', () => {
  it('counts overshoots properly', () => {
    const result = computeStats([
      {
        playerIds: ['a', 'b'],
        throws: [
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [1] },
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [1] },
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [1] },
          { playerId: 'a', fallenPins: [12] },
          { playerId: 'b', fallenPins: [1] },
          { playerId: 'a', fallenPins: [12] },
        ],
        winnerId: null,
      },
    ]);
    expect(result.get('a')?.overshoots).toBe(1);
  });
});
