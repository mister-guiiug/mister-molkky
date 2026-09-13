import { describe, expect, it } from 'vitest';
import type { MatchOutcome, PlayerProgress } from './rules';
import { buildRanking } from './ranking';

/**
 * Le classement final est ce que le joueur RETIENT d'une partie, et le
 * comparateur qui le produit n'avait que sa première règle éprouvée : les
 * quatre autres — éliminé contre survivant, éliminé contre éliminé, et le
 * départage au score — n'étaient traversées par rien.
 *
 * L'ordre d'élimination compte à l'envers de l'intuition : le DERNIER éliminé
 * s'est battu le plus longtemps, il passe devant. Une inversion de signe dans
 * cette ligne ne casse aucun type et se lit comme une injustice.
 */

function progres(
  playerId: string,
  partiel: Partial<PlayerProgress> = {}
): PlayerProgress {
  return {
    playerId,
    score: 0,
    missStreak: 0,
    eliminated: false,
    hasWon: false,
    consecutiveScoringHits: 0,
    longestStreak: 0,
    totalThrows: 0,
    pinsHit: 0,
    ...partiel,
  };
}

function resultat(...joueurs: readonly PlayerProgress[]): MatchOutcome {
  return {
    progress: new Map(joueurs.map(p => [p.playerId, p])),
    winnerId: joueurs.find(p => p.hasWon)?.playerId ?? null,
    currentPlayerIndex: 0,
    currentTurn: 1,
    isOver: true,
  };
}

const ordre = (entries: ReturnType<typeof buildRanking>) =>
  entries.map(e => e.playerId);

describe('buildRanking', () => {
  it('le vainqueur passe devant, quel que soit son score', () => {
    // Il gagne EN ATTEIGNANT la cible : son score n'est pas le plus haut par
    // accident, il l'est par définition. Mais un vainqueur en variante
    // inverse finit au contraire tout en bas de l'échelle des points.
    const classement = buildRanking(
      ['a', 'b'],
      resultat(
        progres('a', { score: 0, hasWon: true }),
        progres('b', { score: 49 })
      )
    );

    expect(ordre(classement)).toEqual(['a', 'b']);
    expect(classement[0]).toMatchObject({ rank: 1, hasWon: true });
    expect(classement[1]).toMatchObject({ rank: 2, hasWon: false });
  });

  it('le vainqueur passe devant même donné en dernier', () => {
    // La deuxième moitié du comparateur (`b.hasWon && !a.hasWon`) : sans elle
    // le tri dépendrait de l'ordre d'entrée.
    const classement = buildRanking(
      ['b', 'a'],
      resultat(
        progres('b', { score: 49 }),
        progres('a', { score: 0, hasWon: true })
      )
    );

    expect(ordre(classement)).toEqual(['a', 'b']);
  });

  it('un survivant passe devant un éliminé, même avec MOINS de points', () => {
    const classement = buildRanking(
      ['elimine', 'survivant'],
      resultat(
        progres('elimine', { score: 45, eliminated: true }),
        progres('survivant', { score: 3 })
      )
    );

    expect(ordre(classement)).toEqual(['survivant', 'elimine']);
  });

  it('… et dans l’autre sens d’entrée aussi', () => {
    const classement = buildRanking(
      ['survivant', 'elimine'],
      resultat(
        progres('survivant', { score: 3 }),
        progres('elimine', { score: 45, eliminated: true })
      )
    );

    expect(ordre(classement)).toEqual(['survivant', 'elimine']);
  });

  it('entre éliminés, le DERNIER sorti passe devant', () => {
    // Il a tenu le plus longtemps. Le score ne départage pas ici : celui qui
    // sort en premier peut très bien avoir le plus de points au moment de
    // sortir, ce serait le récompenser d'être parti tôt.
    const classement = buildRanking(
      ['premierSorti', 'dernierSorti'],
      resultat(
        progres('premierSorti', { score: 48, eliminated: true }),
        progres('dernierSorti', { score: 2, eliminated: true })
      ),
      ['premierSorti', 'dernierSorti']
    );

    expect(ordre(classement)).toEqual(['dernierSorti', 'premierSorti']);
  });

  it('sans ordre d’élimination fourni, les éliminés restent départagés', () => {
    // `elimIndex` vaut alors -1 pour tout le monde : la comparaison rend 0 et
    // l'ordre d'entrée est conservé. Le classement reste STABLE plutôt que
    // de dépendre du moteur de tri.
    const classement = buildRanking(
      ['x', 'y'],
      resultat(
        progres('x', { score: 10, eliminated: true }),
        progres('y', { score: 40, eliminated: true })
      )
    );

    expect(ordre(classement)).toEqual(['x', 'y']);
  });

  it('à égalité de statut, le plus haut score passe devant', () => {
    const classement = buildRanking(
      ['petit', 'grand', 'moyen'],
      resultat(
        progres('petit', { score: 12 }),
        progres('grand', { score: 47 }),
        progres('moyen', { score: 30 })
      )
    );

    expect(ordre(classement)).toEqual(['grand', 'moyen', 'petit']);
    expect(classement.map(e => e.rank)).toEqual([1, 2, 3]);
  });

  it('un joueur absent du résultat est classé à zéro plutôt que d’échouer', () => {
    // Cas d'une partie abandonnée ou d'un historique abîmé : mieux vaut un
    // dernier à zéro qu'un écran qui ne s'affiche pas.
    const classement = buildRanking(
      ['present', 'fantome'],
      resultat(progres('present', { score: 20 }))
    );

    expect(ordre(classement)).toEqual(['present', 'fantome']);
    expect(classement[1]).toMatchObject({
      playerId: 'fantome',
      finalScore: 0,
      eliminated: false,
      hasWon: false,
      rank: 2,
    });
  });

  it('les rangs sont contigus et commencent à 1', () => {
    const classement = buildRanking(
      ['a', 'b', 'c', 'd'],
      resultat(
        progres('a', { hasWon: true }),
        progres('b', { score: 30 }),
        progres('c', { score: 10, eliminated: true }),
        progres('d', { score: 20 })
      ),
      ['c']
    );

    expect(classement.map(e => e.rank)).toEqual([1, 2, 3, 4]);
    expect(ordre(classement)).toEqual(['a', 'b', 'd', 'c']);
  });
});
