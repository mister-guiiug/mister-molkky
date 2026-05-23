import type { FinishedMatch } from '../schemas';

/**
 * Symbolic icon name for an achievement. The UI layer maps this name to
 * a concrete Lucide React component — keeping the rules module free of
 * any React dependency. See `react/components/icons.tsx`.
 */
export type AchievementIconName =
  | 'target'
  | 'flame'
  | 'zap'
  | 'trophy'
  | 'medal'
  | 'trending-up';

export interface AchievementDef {
  readonly id: string;
  readonly iconName: AchievementIconName;
  readonly labelKey:
    | 'achievements.firstFifty'
    | 'achievements.threeInARow'
    | 'achievements.fastWin'
    | 'achievements.perfectGame'
    | 'achievements.veteran'
    | 'achievements.comeback';
  readonly descKey: AchievementDef['labelKey'] extends infer L
    ? L extends string
      ? `${L}Desc`
      : never
    : never;
}

export interface UnlockedAchievement {
  readonly def: AchievementDef;
  readonly unlockedAt: number;
  readonly matchId?: string;
}

const DEFS: AchievementDef[] = [
  {
    id: 'first-fifty',
    iconName: 'target',
    labelKey: 'achievements.firstFifty',
    descKey: 'achievements.firstFiftyDesc',
  },
  {
    id: 'three-in-a-row',
    iconName: 'flame',
    labelKey: 'achievements.threeInARow',
    descKey: 'achievements.threeInARowDesc',
  },
  {
    id: 'fast-win',
    iconName: 'zap',
    labelKey: 'achievements.fastWin',
    descKey: 'achievements.fastWinDesc',
  },
  {
    id: 'perfect-game',
    iconName: 'trophy',
    labelKey: 'achievements.perfectGame',
    descKey: 'achievements.perfectGameDesc',
  },
  {
    id: 'veteran',
    iconName: 'medal',
    labelKey: 'achievements.veteran',
    descKey: 'achievements.veteranDesc',
  },
  {
    id: 'comeback',
    iconName: 'trending-up',
    labelKey: 'achievements.comeback',
    descKey: 'achievements.comebackDesc',
  },
];

export function listAchievementDefs(): readonly AchievementDef[] {
  return DEFS;
}

/**
 * Walk the player's match history and return the badges they have unlocked.
 * Each detector is pure: same history → same achievements list.
 */
export function detectAchievements(
  playerId: string,
  history: readonly FinishedMatch[]
): UnlockedAchievement[] {
  const out: UnlockedAchievement[] = [];
  const seen = new Set<string>();

  const playerMatches = history.filter(m =>
    m.config.players.some(p => p.id === playerId)
  );

  for (const match of playerMatches) {
    const isWin = match.winnerId === playerId;
    const playerThrows = match.throws.filter(t => t.playerId === playerId);
    const finalScoreEntry = match.ranking.find(r => r.playerId === playerId);

    if (
      isWin &&
      !seen.has('first-fifty') &&
      finalScoreEntry?.finalScore === match.config.targetScore
    ) {
      seen.add('first-fifty');
      out.push({
        def: DEFS[0]!,
        unlockedAt: match.finishedAt,
        matchId: match.id,
      });
    }
    if (
      isWin &&
      !seen.has('fast-win') &&
      playerThrows.length > 0 &&
      playerThrows.length < 10
    ) {
      seen.add('fast-win');
      out.push({
        def: DEFS[2]!,
        unlockedAt: match.finishedAt,
        matchId: match.id,
      });
    }
    if (
      isWin &&
      !seen.has('perfect-game') &&
      playerThrows.length > 0 &&
      playerThrows.every(t => t.computedScore > 0)
    ) {
      seen.add('perfect-game');
      out.push({
        def: DEFS[3]!,
        unlockedAt: match.finishedAt,
        matchId: match.id,
      });
    }
  }

  if (!seen.has('three-in-a-row') && playerMatches.length >= 3) {
    const recent = [...playerMatches]
      .sort((a, b) => b.finishedAt - a.finishedAt)
      .slice(0, 3);
    if (recent.every(m => m.winnerId === playerId)) {
      seen.add('three-in-a-row');
      out.push({
        def: DEFS[1]!,
        unlockedAt: recent[0]!.finishedAt,
        matchId: recent[0]!.id,
      });
    }
  }

  if (!seen.has('veteran') && playerMatches.length >= 10) {
    seen.add('veteran');
    const latest = [...playerMatches].sort(
      (a, b) => b.finishedAt - a.finishedAt
    )[0]!;
    out.push({
      def: DEFS[4]!,
      unlockedAt: latest.finishedAt,
      matchId: latest.id,
    });
  }

  for (const match of playerMatches) {
    if (match.winnerId !== playerId) continue;
    if (seen.has('comeback')) break;
    const ranking = match.ranking.find(r => r.playerId === playerId);
    if (!ranking) continue;
    const playerThrows = match.throws.filter(t => t.playerId === playerId);
    if (playerThrows.some(t => t.resultedInOvershoot)) {
      seen.add('comeback');
      out.push({
        def: DEFS[5]!,
        unlockedAt: match.finishedAt,
        matchId: match.id,
      });
      break;
    }
  }

  return out;
}
