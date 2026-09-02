import { z } from 'zod';

export const PlayerIdSchema = z.string().min(1).brand<'PlayerId'>();
export type PlayerId = z.infer<typeof PlayerIdSchema>;

const MatchIdSchema = z.string().min(1).brand<'MatchId'>();
export type MatchId = z.infer<typeof MatchIdSchema>;

const HexColorSchema = z
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

const TargetScoreSchema = z.union([
  z.literal(25),
  z.literal(50),
  z.literal(100),
]);
export type TargetScore = z.infer<typeof TargetScoreSchema>;

const TeamModeSchema = z.enum(['solo', 'duo', 'trio']);
export type TeamMode = z.infer<typeof TeamModeSchema>;

const TeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(30),
  color: HexColorSchema,
  playerIds: z.array(PlayerIdSchema).min(1),
});
export type Team = z.infer<typeof TeamSchema>;

const RuleVariantSchema = z.enum(['classic', 'inverse', 'free']);
export type RuleVariant = z.infer<typeof RuleVariantSchema>;

/**
 * How the rules react when a player reaches `maxMisses` consecutive misses:
 * - 'elimination' (Mölkky standard): the player is out for the rest of the match
 * - 'reset':                         the player's score drops back to the start
 *                                    (0 in classic / target in inverse) and the
 *                                    miss streak clears — they keep playing
 * - 'none':                          the streak counter still increments visually
 *                                    but never triggers anything (casual mode)
 */
const MissSanctionSchema = z.enum(['elimination', 'reset', 'none']);
export type MissSanction = z.infer<typeof MissSanctionSchema>;

export const MatchConfigSchema = z.object({
  players: z.array(PlayerSchema).min(2).max(16),
  targetScore: TargetScoreSchema.default(50),
  overshootPenalty: z.number().int().min(0).max(50).default(25),
  maxMisses: z.number().int().min(1).max(5).default(3),
  missSanction: MissSanctionSchema.default('elimination'),
  teamMode: TeamModeSchema.default('solo'),
  teams: z.array(TeamSchema).default([]),
  variant: RuleVariantSchema.default('classic'),
  shufflePlayers: z.boolean().default(false),
  // Per-actor starting-score offset. Map keys are actor IDs (player IDs
  // in solo, team IDs in team mode); values are added to (classic) or
  // subtracted from (inverse) the variant's normal starting score so a
  // stronger player can give a head start. Empty map = no handicap.
  handicaps: z.record(z.string(), z.number().int()).default({}),
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
  // Call-your-shot: pin the player announced they would hit before
  // throwing. Optional — only set when the user enabled the feature.
  // Used to render a hit/miss badge in the throws log.
  calledPin: z.number().int().min(1).max(12).optional(),
});
export type Throw = z.infer<typeof ThrowSchema>;

const RankingEntrySchema = z.object({
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
  // Throw IDs the player flagged with a star during the match.
  highlightedThrowIds: z.array(z.string().min(1)).default([]),
  // Predictions made before the match, preserved post-finish.
  predictions: z.record(z.string(), z.string()).default({}),
});
export type FinishedMatch = z.infer<typeof FinishedMatchSchema>;

export const CurrentMatchStateSchema = z.object({
  id: MatchIdSchema,
  config: MatchConfigSchema,
  throws: z.array(ThrowSchema),
  startedAt: z.number().int(),
  // Actors (player IDs in solo mode, team IDs in team mode) who tapped
  // "Abandonner" mid-match. Treated as eliminated for ranking + turn
  // rotation. Defaulted to [] so persisted matches from before the
  // forfeit feature still parse cleanly.
  forfeitedActorIds: z.array(z.string().min(1)).default([]),
  // Throw IDs flagged with a star during the match — surfaced in the
  // ThrowsLog and the final ranking for replay/sharing.
  highlightedThrowIds: z.array(z.string().min(1)).default([]),
  // Optional pre-match predictions: keys = predictor player ID, values
  // = who they think will win. Resolved at finish — bragging rights for
  // correct picks. Defaults to {} when nobody bothered predicting.
  predictions: z.record(z.string(), z.string()).default({}),
  // Live chrono pause state. `pausedAt` is the epoch-ms timestamp of the
  // current pause (null while running); `pausedTotalMs` accumulates the
  // time spent in earlier pauses so the elapsed display = now - startedAt
  // - pausedTotalMs. Defaulted so matches saved before the pause feature
  // still parse.
  pausedAt: z.number().int().nullable().default(null),
  pausedTotalMs: z.number().int().min(0).default(0),
});
export type CurrentMatchState = z.infer<typeof CurrentMatchStateSchema>;

export const MatchTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  targetScore: TargetScoreSchema,
  overshootPenalty: z.number().int().min(0).max(50),
  maxMisses: z.number().int().min(1).max(5),
  missSanction: MissSanctionSchema.default('elimination'),
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

const LocaleSchema = z.enum(['fr', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const SettingsSchema = z.object({
  locale: LocaleSchema.default('fr'),
  sounds: z.boolean().default(true),
  vibrations: z.boolean().default(true),
  wakeLock: z.boolean().default(true),
  outdoor: z.boolean().default(false),
  colorblind: z.boolean().default(false),
  // In-match coach hint: shows the optimal pin/combo for the current
  // score above the PinsBoard. Defaults on — pedagogical, easy to ignore.
  coach: z.boolean().default(true),
  // Voice announcer (Web Speech API) — calls turn changes + scores.
  // Defaults off because TTS in PWAs is heavy and people may find it
  // intrusive; users opt in from Settings.
  voiceAnnouncer: z.boolean().default(false),
  hasSeenWelcome: z.boolean().default(false),
  hasSeenMatchOnboarding: z.boolean().default(false),
});
export type Settings = z.infer<typeof SettingsSchema>;

export function makePlayerId(raw: string): PlayerId {
  return PlayerIdSchema.parse(raw);
}

export function makeMatchId(raw: string): MatchId {
  return MatchIdSchema.parse(raw);
}

/**
 * Identifiant d'entité — DU SOCLE (`@mister-guiiug/dev-wpa-config/id`).
 *
 * Le repli maison rendait `1a2b3c4d5e6f`, qui n'est PAS un UUID : deux formats
 * d'identifiant coexistaient donc selon le navigateur, et rien ne le disait.
 * `createUuid` retombe sur un v4 correct (PARC.md, chantier 3).
 */
export { createUuid as newId } from '@mister-guiiug/dev-wpa-config/id';
