import { z } from 'zod';

export const PlayerIdSchema = z.string().min(1).brand<'PlayerId'>();
export type PlayerId = z.infer<typeof PlayerIdSchema>;

export const MatchIdSchema = z.string().min(1).brand<'MatchId'>();
export type MatchId = z.infer<typeof MatchIdSchema>;

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected #rrggbb');

export const PlayerSchema = z.object({
  id: PlayerIdSchema,
  name: z.string().min(1).max(30),
  color: HexColorSchema,
  avatarBlobKey: z.string().optional(),
  createdAt: z.number().int(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const TargetScoreSchema = z.union([
  z.literal(25),
  z.literal(50),
  z.literal(100),
]);
export type TargetScore = z.infer<typeof TargetScoreSchema>;

export const TeamModeSchema = z.enum(['solo', 'duo', 'trio']);
export type TeamMode = z.infer<typeof TeamModeSchema>;

export const MatchConfigSchema = z.object({
  players: z.array(PlayerSchema).min(2).max(16),
  targetScore: TargetScoreSchema.default(50),
  overshootPenalty: z.number().int().min(0).max(50).default(25),
  maxMisses: z.number().int().min(1).max(5).default(3),
  teamMode: TeamModeSchema.default('solo'),
  shufflePlayers: z.boolean().default(false),
});
export type MatchConfig = z.infer<typeof MatchConfigSchema>;

export const ThrowSchema = z.object({
  id: z.string().min(1),
  playerId: PlayerIdSchema,
  timestamp: z.number().int(),
  fallenPins: z.array(z.number().int().min(1).max(12)),
  computedScore: z.number().int().min(0).max(12),
  resultedInElimination: z.boolean().default(false),
  resultedInOvershoot: z.boolean().default(false),
});
export type Throw = z.infer<typeof ThrowSchema>;

export const RankingEntrySchema = z.object({
  playerId: PlayerIdSchema,
  finalScore: z.number().int(),
  eliminated: z.boolean(),
  rank: z.number().int().min(1),
});
export type Ranking = z.infer<typeof RankingEntrySchema>;

export const FinishedMatchSchema = z.object({
  id: MatchIdSchema,
  config: MatchConfigSchema,
  throws: z.array(ThrowSchema),
  startedAt: z.number().int(),
  finishedAt: z.number().int(),
  winnerId: PlayerIdSchema,
  ranking: z.array(RankingEntrySchema),
});
export type FinishedMatch = z.infer<typeof FinishedMatchSchema>;

export const CurrentMatchStateSchema = z.object({
  id: MatchIdSchema,
  config: MatchConfigSchema,
  throws: z.array(ThrowSchema),
  startedAt: z.number().int(),
});
export type CurrentMatchState = z.infer<typeof CurrentMatchStateSchema>;

export const MatchTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  targetScore: TargetScoreSchema,
  overshootPenalty: z.number().int().min(0).max(50),
  maxMisses: z.number().int().min(1).max(5),
  teamMode: TeamModeSchema.default('solo'),
  playerIds: z.array(PlayerIdSchema).default([]),
  createdAt: z.number().int(),
});
export type MatchTemplate = z.infer<typeof MatchTemplateSchema>;

export const ExportBundleSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number().int(),
  players: z.array(PlayerSchema),
  matches: z.array(FinishedMatchSchema),
  templates: z.array(MatchTemplateSchema).optional(),
});
export type ExportBundle = z.infer<typeof ExportBundleSchema>;

export const LocaleSchema = z.enum(['fr', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const SettingsSchema = z.object({
  locale: LocaleSchema.default('fr'),
  sounds: z.boolean().default(true),
  vibrations: z.boolean().default(true),
  wakeLock: z.boolean().default(true),
  hasSeenWelcome: z.boolean().default(false),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function makePlayerId(raw: string): PlayerId {
  return PlayerIdSchema.parse(raw);
}

export function makeMatchId(raw: string): MatchId {
  return MatchIdSchema.parse(raw);
}

export function newId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    'randomUUID' in globalThis.crypto
  ) {
    return globalThis.crypto.randomUUID();
  }
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}
