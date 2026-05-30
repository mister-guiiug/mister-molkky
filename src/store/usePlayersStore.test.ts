import { beforeEach, describe, expect, it } from 'vitest';
import { pickNextColor, usePlayersStore } from './usePlayersStore';

beforeEach(() => {
  usePlayersStore.setState({ players: [] });
});

describe('usePlayersStore', () => {
  it('starts with an empty roster', () => {
    expect(usePlayersStore.getState().players).toEqual([]);
  });

  it('adds a player with an auto colour when none is provided', () => {
    const p = usePlayersStore.getState().add({ name: 'Alice', color: '' });
    expect(p.name).toBe('Alice');
    expect(p.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(usePlayersStore.getState().players).toHaveLength(1);
  });

  it('pickNextColor avoids re-using a colour already in the roster', () => {
    const first = usePlayersStore
      .getState()
      .add({ name: 'A', color: '#4a7c2a' });
    const fresh = pickNextColor([first]);
    expect(fresh.toLowerCase()).not.toBe('#4a7c2a');
  });

  it('updates the player name and keeps the createdAt timestamp stable', () => {
    const p = usePlayersStore.getState().add({ name: 'Bob', color: '#ff0000' });
    const original = p.createdAt;
    usePlayersStore.getState().update(p.id, { name: 'Bobby' });
    const updated = usePlayersStore.getState().players[0]!;
    expect(updated.name).toBe('Bobby');
    expect(updated.createdAt).toBe(original);
  });

  it('removes a player', () => {
    const p = usePlayersStore
      .getState()
      .add({ name: 'Carol', color: '#0000ff' });
    usePlayersStore.getState().remove(p.id);
    expect(usePlayersStore.getState().players).toHaveLength(0);
  });

  it('falls back to a default name when the supplied name is empty', () => {
    const p = usePlayersStore.getState().add({ name: '   ', color: '#123456' });
    expect(p.name).toBe('Joueur');
  });
});
