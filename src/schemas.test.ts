import { describe, expect, it } from 'vitest';
import {
  ExportBundleSchema,
  FinishedMatchSchema,
  MatchConfigSchema,
  PlayerSchema,
  ThrowSchema,
  makeMatchId,
  makePlayerId,
  newId,
} from './schemas';

describe('schemas', () => {
  it('PlayerSchema round-trips a valid player', () => {
    const raw = {
      id: makePlayerId('p-1'),
      name: 'Alice',
      color: '#4a7c2a',
      createdAt: 1700000000000,
    };
    const parsed = PlayerSchema.parse(raw);
    expect(parsed.name).toBe('Alice');
  });

  it('PlayerSchema rejects empty names', () => {
    expect(() =>
      PlayerSchema.parse({
        id: makePlayerId('p-2'),
        name: '',
        color: '#000000',
        createdAt: 1,
      })
    ).toThrow();
  });

  it('PlayerSchema rejects malformed colors', () => {
    expect(() =>
      PlayerSchema.parse({
        id: makePlayerId('p-3'),
        name: 'Bob',
        color: 'red',
        createdAt: 1,
      })
    ).toThrow();
  });

  it('MatchConfigSchema applies defaults', () => {
    const parsed = MatchConfigSchema.parse({
      players: [
        { id: makePlayerId('a'), name: 'A', color: '#111111', createdAt: 1 },
        { id: makePlayerId('b'), name: 'B', color: '#222222', createdAt: 2 },
      ],
    });
    expect(parsed.targetScore).toBe(50);
    expect(parsed.overshootPenalty).toBe(25);
    expect(parsed.maxMisses).toBe(3);
  });

  it('MatchConfigSchema requires at least 2 players', () => {
    expect(() =>
      MatchConfigSchema.parse({
        players: [
          { id: makePlayerId('a'), name: 'A', color: '#111111', createdAt: 1 },
        ],
      })
    ).toThrow();
  });

  it('ThrowSchema validates pin ranges', () => {
    expect(() =>
      ThrowSchema.parse({
        id: 'tx',
        playerId: makePlayerId('a'),
        timestamp: 1,
        fallenPins: [13],
        computedScore: 0,
      })
    ).toThrow();
  });

  it('FinishedMatchSchema accepts a complete match', () => {
    const match = FinishedMatchSchema.parse({
      id: makeMatchId(newId()),
      config: {
        players: [
          { id: makePlayerId('a'), name: 'A', color: '#111111', createdAt: 1 },
          { id: makePlayerId('b'), name: 'B', color: '#222222', createdAt: 2 },
        ],
      },
      throws: [],
      startedAt: 1,
      finishedAt: 2,
      winnerId: makePlayerId('a'),
      ranking: [
        {
          playerId: makePlayerId('a'),
          finalScore: 50,
          eliminated: false,
          rank: 1,
        },
      ],
    });
    expect(match.winnerId).toBe('a');
  });

  it('ExportBundleSchema validates the export envelope', () => {
    const bundle = ExportBundleSchema.parse({
      version: 1,
      exportedAt: 1,
      players: [],
      matches: [],
    });
    expect(bundle.version).toBe(1);
  });

  it('newId returns a non-empty string', () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(5);
  });
});
