import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMatchStore } from './useMatchStore';
import { MatchConfigSchema, makePlayerId, type MatchConfig } from '../schemas';

function setupConfig(): MatchConfig {
  return MatchConfigSchema.parse({
    players: [
      {
        id: makePlayerId('p-a'),
        name: 'Alice',
        color: '#4a7c2a',
        createdAt: 1,
      },
      { id: makePlayerId('p-b'), name: 'Bob', color: '#d4892b', createdAt: 2 },
    ],
    targetScore: 50,
  });
}

beforeEach(() => {
  useMatchStore.setState({
    current: null,
    history: [],
    pendingFeedback: null,
  });
});

describe('useMatchStore', () => {
  it('starts an empty match', () => {
    useMatchStore.getState().startMatch(setupConfig());
    const c = useMatchStore.getState().current;
    expect(c).not.toBeNull();
    expect(c?.throws).toHaveLength(0);
  });

  it('records a throw and updates feedback', () => {
    useMatchStore.getState().startMatch(setupConfig());
    const res = useMatchStore.getState().recordThrow([7]);
    expect(res.ok).toBe(true);
    expect(useMatchStore.getState().current?.throws).toHaveLength(1);
    expect(useMatchStore.getState().pendingFeedback).toBe('throw');
  });

  it('detects overshoot', () => {
    useMatchStore.getState().startMatch(setupConfig());
    const s = useMatchStore.getState();
    for (let i = 0; i < 4; i += 1) {
      s.recordThrow([12]);
      s.recordThrow([1]);
    }
    const r = useMatchStore.getState().recordThrow([12]);
    expect(r.overshoot).toBe(true);
  });

  it('records elimination', () => {
    useMatchStore.getState().startMatch(setupConfig());
    const s = useMatchStore.getState();
    s.recordThrow([]);
    s.recordThrow([1]);
    s.recordThrow([]);
    s.recordThrow([1]);
    const r = s.recordThrow([]);
    expect(r.eliminated).toBe(true);
  });

  it('finalizes match on victory and saves to history', () => {
    useMatchStore.getState().startMatch(setupConfig());
    const s = useMatchStore.getState();
    for (let i = 0; i < 4; i += 1) {
      s.recordThrow([12]);
      s.recordThrow([1]);
    }
    const r = s.recordThrow([2]);
    expect(r.won).toBe(true);
    expect(useMatchStore.getState().current).toBeNull();
    expect(useMatchStore.getState().history).toHaveLength(1);
    expect(useMatchStore.getState().history[0]?.winnerId).toBe('p-a');
    expect(useMatchStore.getState().history[0]?.ranking[0]?.rank).toBe(1);
  });

  it('undo removes the last throw', () => {
    useMatchStore.getState().startMatch(setupConfig());
    useMatchStore.getState().recordThrow([5]);
    expect(useMatchStore.getState().current?.throws).toHaveLength(1);
    expect(useMatchStore.getState().undoLastThrow()).toBe(true);
    expect(useMatchStore.getState().current?.throws).toHaveLength(0);
  });

  it('undo returns false when no throws', () => {
    useMatchStore.getState().startMatch(setupConfig());
    expect(useMatchStore.getState().undoLastThrow()).toBe(false);
  });

  it('abandonMatch clears current', () => {
    useMatchStore.getState().startMatch(setupConfig());
    useMatchStore.getState().abandonMatch();
    expect(useMatchStore.getState().current).toBeNull();
  });

  it('removeFromHistory removes by id', () => {
    useMatchStore.getState().startMatch(setupConfig());
    const s = useMatchStore.getState();
    for (let i = 0; i < 4; i += 1) {
      s.recordThrow([12]);
      s.recordThrow([1]);
    }
    s.recordThrow([2]);
    const id = useMatchStore.getState().history[0]!.id;
    useMatchStore.getState().removeFromHistory(id);
    expect(useMatchStore.getState().history).toHaveLength(0);
  });
});

describe('useMatchStore — chrono pause/resume', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a match with the chrono running (no pause)', () => {
    useMatchStore.getState().startMatch(setupConfig());
    const c = useMatchStore.getState().current;
    expect(c?.pausedAt).toBeNull();
    expect(c?.pausedTotalMs).toBe(0);
  });

  it('pauseChrono stamps pausedAt and is idempotent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    useMatchStore.getState().startMatch(setupConfig());

    vi.advanceTimersByTime(60_000);
    useMatchStore.getState().pauseChrono();
    const pausedAt = useMatchStore.getState().current?.pausedAt;
    expect(typeof pausedAt).toBe('number');

    // A second pause must not move the timestamp.
    vi.advanceTimersByTime(5_000);
    useMatchStore.getState().pauseChrono();
    expect(useMatchStore.getState().current?.pausedAt).toBe(pausedAt);
  });

  it('resumeChrono clears the pause and folds elapsed time into pausedTotalMs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    useMatchStore.getState().startMatch(setupConfig());

    useMatchStore.getState().pauseChrono();
    vi.advanceTimersByTime(30_000);
    useMatchStore.getState().resumeChrono();

    const c = useMatchStore.getState().current;
    expect(c?.pausedAt).toBeNull();
    expect(c?.pausedTotalMs).toBe(30_000);
  });

  it('accumulates across multiple pause/resume cycles', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    useMatchStore.getState().startMatch(setupConfig());

    useMatchStore.getState().pauseChrono();
    vi.advanceTimersByTime(10_000);
    useMatchStore.getState().resumeChrono();

    vi.advanceTimersByTime(5_000);
    useMatchStore.getState().pauseChrono();
    vi.advanceTimersByTime(20_000);
    useMatchStore.getState().resumeChrono();

    expect(useMatchStore.getState().current?.pausedTotalMs).toBe(30_000);
  });

  it('resumeChrono is a no-op when the chrono is not paused', () => {
    useMatchStore.getState().startMatch(setupConfig());
    useMatchStore.getState().resumeChrono();
    expect(useMatchStore.getState().current?.pausedTotalMs).toBe(0);
    expect(useMatchStore.getState().current?.pausedAt).toBeNull();
  });

  it('recordThrow auto-resumes an open pause and excludes the break', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    useMatchStore.getState().startMatch(setupConfig());

    useMatchStore.getState().pauseChrono();
    vi.advanceTimersByTime(15_000);
    useMatchStore.getState().recordThrow([7]);

    const c = useMatchStore.getState().current;
    expect(c?.pausedAt).toBeNull();
    expect(c?.pausedTotalMs).toBe(15_000);
    expect(c?.throws).toHaveLength(1);
  });

  it('pause/resume are no-ops when there is no current match', () => {
    expect(() => {
      useMatchStore.getState().pauseChrono();
      useMatchStore.getState().resumeChrono();
    }).not.toThrow();
    expect(useMatchStore.getState().current).toBeNull();
  });
});
