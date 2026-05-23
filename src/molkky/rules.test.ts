import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULE_SETTINGS,
  evaluateThrow,
  isValidThrow,
  replayThrows,
  scoreForThrow,
  currentPlayer,
} from './rules';

describe('scoreForThrow', () => {
  it('returns 0 when no pins fall', () => {
    expect(scoreForThrow([])).toBe(0);
  });

  it('returns the pin number when one pin falls', () => {
    expect(scoreForThrow([7])).toBe(7);
    expect(scoreForThrow([1])).toBe(1);
    expect(scoreForThrow([12])).toBe(12);
  });

  it('returns the count when multiple pins fall', () => {
    expect(scoreForThrow([3, 9])).toBe(2);
    expect(scoreForThrow([1, 2, 4, 8, 11])).toBe(5);
    expect(scoreForThrow([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe(12);
  });

  it('rejects pin numbers outside 1..12', () => {
    expect(() => scoreForThrow([0])).toThrow();
    expect(() => scoreForThrow([13])).toThrow();
    expect(() => scoreForThrow([1, 99])).toThrow();
  });
});

describe('evaluateThrow', () => {
  it('overshoot brings score back to penalty value', () => {
    const e = evaluateThrow(45, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(e.score).toBe(12);
    expect(e.overshoot).toBe(true);
    expect(e.nextScore).toBe(25);
    expect(e.wonThisThrow).toBe(false);
  });

  it('exact target triggers victory', () => {
    const e = evaluateThrow(42, [8]);
    expect(e.nextScore).toBe(50);
    expect(e.wonThisThrow).toBe(true);
    expect(e.overshoot).toBe(false);
  });

  it('miss does not overshoot even at 50', () => {
    const e = evaluateThrow(50, []);
    expect(e.score).toBe(0);
    expect(e.overshoot).toBe(false);
    expect(e.nextScore).toBe(50);
  });

  it('inverse variant: throw subtracts from score', () => {
    const e = evaluateThrow(50, [7], { ...DEFAULT_RULE_SETTINGS, variant: 'inverse' });
    expect(e.nextScore).toBe(43);
    expect(e.wonThisThrow).toBe(false);
  });

  it('inverse variant: exact 0 wins', () => {
    const e = evaluateThrow(7, [7], { ...DEFAULT_RULE_SETTINGS, variant: 'inverse' });
    expect(e.nextScore).toBe(0);
    expect(e.wonThisThrow).toBe(true);
  });

  it('inverse variant: overshoot adds 5 capped at target', () => {
    const e = evaluateThrow(3, [12], { ...DEFAULT_RULE_SETTINGS, variant: 'inverse' });
    expect(e.overshoot).toBe(true);
    expect(e.nextScore).toBe(8);
  });

  it('free variant: overshoot does not reset to 25', () => {
    const e = evaluateThrow(45, [12], { ...DEFAULT_RULE_SETTINGS, variant: 'free' });
    expect(e.overshoot).toBe(true);
    expect(e.nextScore).toBe(45);
  });

  it('respects custom target & penalty', () => {
    const e = evaluateThrow(20, [7], { ...DEFAULT_RULE_SETTINGS, targetScore: 25, overshootPenalty: 10 });
    expect(e.overshoot).toBe(true);
    expect(e.nextScore).toBe(10);
  });
});

describe('isValidThrow', () => {
  it('accepts an empty miss', () => {
    expect(isValidThrow([])).toBe(true);
  });

  it('rejects duplicates', () => {
    expect(isValidThrow([3, 3])).toBe(false);
  });

  it('rejects out-of-range pins', () => {
    expect(isValidThrow([0])).toBe(false);
    expect(isValidThrow([13])).toBe(false);
    expect(isValidThrow([1.5])).toBe(false);
  });

  it('accepts valid pin sets', () => {
    expect(isValidThrow([1, 2, 3])).toBe(true);
    expect(isValidThrow([12])).toBe(true);
  });
});

describe('replayThrows — basic flow', () => {
  it('requires at least 2 players', () => {
    expect(() => replayThrows(['a'], [])).toThrow();
  });

  it('starts with zero scores', () => {
    const out = replayThrows(['a', 'b'], []);
    expect(out.progress.get('a')?.score).toBe(0);
    expect(out.progress.get('b')?.score).toBe(0);
    expect(out.winnerId).toBeNull();
    expect(out.isOver).toBe(false);
  });

  it('alternates turns', () => {
    const out = replayThrows(['a', 'b', 'c'], [
      { playerId: 'a', fallenPins: [3] },
      { playerId: 'b', fallenPins: [5] },
      { playerId: 'c', fallenPins: [7] },
      { playerId: 'a', fallenPins: [1] },
    ]);
    expect(out.progress.get('a')?.score).toBe(4);
    expect(out.progress.get('b')?.score).toBe(5);
    expect(out.progress.get('c')?.score).toBe(7);
    expect(currentPlayer(['a', 'b', 'c'], out)).toBe('b');
  });

  it('throws when a player throws out of turn', () => {
    expect(() =>
      replayThrows(['a', 'b'], [
        { playerId: 'b', fallenPins: [3] },
      ])
    ).toThrow();
  });
});

describe('replayThrows — victory', () => {
  it('declares the player who hits exactly the target the winner', () => {
    const out = replayThrows(['a', 'b'], [
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [12] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [12] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [12] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [12] },
      { playerId: 'a', fallenPins: [2] },
    ]);
    expect(out.winnerId).toBe('a');
    expect(out.isOver).toBe(true);
    expect(out.progress.get('a')?.score).toBe(50);
    expect(out.progress.get('a')?.hasWon).toBe(true);
  });

  it('throws after victory are ignored', () => {
    const out = replayThrows(['a', 'b'], [
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [12] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [12] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [12] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [12] },
      { playerId: 'a', fallenPins: [2] },
      { playerId: 'b', fallenPins: [12] },
    ]);
    expect(out.winnerId).toBe('a');
    expect(out.progress.get('b')?.score).toBe(48);
  });

  it('overshoot brings score back to 25', () => {
    const out = replayThrows(['a', 'b'], [
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [12] },
    ]);
    expect(out.progress.get('a')?.score).toBe(25);
    expect(out.winnerId).toBeNull();
  });
});

describe('replayThrows — elimination', () => {
  it('eliminates a player after 3 consecutive misses', () => {
    const out = replayThrows(['a', 'b'], [
      { playerId: 'a', fallenPins: [] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [] },
    ]);
    expect(out.progress.get('a')?.eliminated).toBe(true);
    expect(out.progress.get('a')?.missStreak).toBe(3);
    expect(out.winnerId).toBe('b');
  });

  it('a scoring throw resets the miss streak', () => {
    const out = replayThrows(['a', 'b'], [
      { playerId: 'a', fallenPins: [] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [3] },
      { playerId: 'b', fallenPins: [1] },
      { playerId: 'a', fallenPins: [] },
    ]);
    expect(out.progress.get('a')?.eliminated).toBe(false);
    expect(out.progress.get('a')?.missStreak).toBe(1);
  });

  it('declares the last non-eliminated player the winner', () => {
    const out = replayThrows(['a', 'b', 'c'], [
      { playerId: 'a', fallenPins: [1] },
      { playerId: 'b', fallenPins: [] },
      { playerId: 'c', fallenPins: [] },
      { playerId: 'a', fallenPins: [1] },
      { playerId: 'b', fallenPins: [] },
      { playerId: 'c', fallenPins: [] },
      { playerId: 'a', fallenPins: [1] },
      { playerId: 'b', fallenPins: [] },
      { playerId: 'c', fallenPins: [] },
    ]);
    expect(out.progress.get('b')?.eliminated).toBe(true);
    expect(out.progress.get('c')?.eliminated).toBe(true);
    expect(out.winnerId).toBe('a');
  });
});

describe('replayThrows — turn order with eliminations', () => {
  it('skips eliminated players in the turn order', () => {
    const out = replayThrows(['a', 'b', 'c'], [
      { playerId: 'a', fallenPins: [1] },
      { playerId: 'b', fallenPins: [] },
      { playerId: 'c', fallenPins: [5] },
      { playerId: 'a', fallenPins: [1] },
      { playerId: 'b', fallenPins: [] },
      { playerId: 'c', fallenPins: [5] },
      { playerId: 'a', fallenPins: [1] },
      { playerId: 'b', fallenPins: [] },
    ]);
    expect(out.progress.get('b')?.eliminated).toBe(true);
    expect(currentPlayer(['a', 'b', 'c'], out)).toBe('c');
  });

  it('tracks longest scoring streak', () => {
    const out = replayThrows(['a', 'b'], [
      { playerId: 'a', fallenPins: [3] },
      { playerId: 'b', fallenPins: [3] },
      { playerId: 'a', fallenPins: [5] },
      { playerId: 'b', fallenPins: [3] },
      { playerId: 'a', fallenPins: [7] },
      { playerId: 'b', fallenPins: [3] },
      { playerId: 'a', fallenPins: [] },
    ]);
    expect(out.progress.get('a')?.longestStreak).toBe(3);
    expect(out.progress.get('a')?.consecutiveScoringHits).toBe(0);
  });

  it('counts pins hit for accuracy stats', () => {
    const out = replayThrows(['a', 'b'], [
      { playerId: 'a', fallenPins: [1, 2, 3] },
      { playerId: 'b', fallenPins: [4] },
      { playerId: 'a', fallenPins: [] },
    ]);
    expect(out.progress.get('a')?.pinsHit).toBe(3);
    expect(out.progress.get('a')?.totalThrows).toBe(2);
    expect(out.progress.get('b')?.pinsHit).toBe(1);
  });
});

describe('replayThrows — team mode (actorMap)', () => {
  it('attributes throws to the team and shares score', () => {
    const teamMap = new Map<string, string>([
      ['alice', 'teamA'],
      ['bob', 'teamA'],
      ['carol', 'teamB'],
      ['dave', 'teamB'],
    ]);
    const out = replayThrows(
      ['teamA', 'teamB'],
      [
        { playerId: 'alice', fallenPins: [7] },
        { playerId: 'carol', fallenPins: [5] },
        { playerId: 'bob', fallenPins: [3] },
        { playerId: 'dave', fallenPins: [2] },
      ],
      undefined,
      teamMap
    );
    expect(out.progress.get('teamA')?.score).toBe(10);
    expect(out.progress.get('teamB')?.score).toBe(7);
  });
});
