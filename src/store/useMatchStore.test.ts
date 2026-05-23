import { beforeEach, describe, expect, it } from 'vitest';
import { useMatchStore } from './useMatchStore';
import { MatchConfigSchema, makePlayerId, type MatchConfig } from '../schemas';

function setupConfig(): MatchConfig {
  return MatchConfigSchema.parse({
    players: [
      { id: makePlayerId('p-a'), name: 'Alice', color: '#4a7c2a', createdAt: 1 },
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
