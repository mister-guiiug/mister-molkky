import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectNoA11yViolations } from '@mister-guiiug/dev-pwa-config/playwright-a11y';

/**
 * LA PARTIE, DU PREMIER LANCER AU PODIUM — ET SON ÉCRAN AUDITÉ.
 *
 * `match.spec.ts` termine une partie par élimination : que des ratés, aucun
 * point compté. Rien ne vérifiait donc, dans un vrai build, ce que l'app sait
 * faire de plus précieux : compter juste. Ici, chaque lancer exerce une règle
 * du Mölkky — une quille seule vaut son numéro, plusieurs quilles valent leur
 * NOMBRE (1 + 2 + 3 tombées font 3, pas 6), un raté ne compte rien mais se
 * compte — et la partie se gagne au score EXACT.
 *
 * L'audit axe, lui, ne passait que sur l'accueil. Il passe ici sur l'écran où
 * l'on reste vingt minutes, dans ses états successifs (consigne du premier
 * lancement, sélecteur d'annonce, quilles choisies, podium), et dans les DEUX
 * thèmes : le Chromium de Playwright se déclare en clair, et une app qui suit
 * le système n'aurait sinon jamais été auditée en sombre.
 */

test.beforeEach(async ({ page }) => {
  // Même graine que `match.spec.ts` : bienvenue déjà vue, aucun son.
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        'mm_settings',
        JSON.stringify({
          state: {
            hasSeenWelcome: true,
            locale: 'fr',
            sounds: false,
            vibrations: false,
            wakeLock: false,
          },
          version: 1,
        })
      );
    } catch {
      /* best-effort: ignore storage seeding failures in the test harness */
    }
  });
});

/** Crée les joueurs dans l'assistant et lance une partie en 25 points. */
async function demarrerPartie(page: Page, joueurs: string[]) {
  await page.goto('/');
  await page
    .getByRole('button', { name: /Nouvelle partie/i })
    .first()
    .click();
  for (const nom of joueurs) {
    await page.getByPlaceholder(/Prénom du joueur/i).fill(nom);
    await page.getByRole('button', { name: /Ajouter un joueur/i }).click();
  }
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByRole('button', { name: '25', exact: true }).click();
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByRole('button', { name: /Démarrer la partie/i }).click();
  await expect(page.getByText('Au tour de', { exact: true })).toBeVisible();
}

/** Le bouton d'une quille, quel que soit son état (debout ou tombée). */
const quille = (page: Page, n: number) =>
  page.getByRole('button', { name: new RegExp(`^Quille numéro ${n},`) });

/** Touche les quilles tombées puis valide le tir. */
async function lancer(page: Page, quilles: number[]) {
  for (const n of quilles) await quille(page, n).click();
  await page.getByRole('button', { name: /^Valider le tir/ }).click();
}

/** Le joueur dont c'est le tour, lu dans l'en-tête de la partie. */
const auTourDe = (page: Page) =>
  page.locator('header').filter({ hasText: 'Au tour de' });

/** La carte d'un joueur dans le tableau des scores. */
const carte = (page: Page, nom: string) =>
  page
    .getByRole('region', { name: 'Score' })
    .getByRole('button')
    .filter({ hasText: nom });

/** Le score affiché sur la carte d'un joueur, seul nombre en gros chiffres. */
async function attendreScore(page: Page, nom: string, score: number) {
  await expect(carte(page, nom)).toHaveAccessibleName(
    new RegExp(`${nom}\\s*${score}\\b`)
  );
}

test('@critical une partie se joue au score, et le premier à 25 tout rond gagne', async ({
  page,
}) => {
  await demarrerPartie(page, ['Alice', 'Bob']);
  await expect(auTourDe(page)).toContainText('Alice');

  // Une quille seule : son numéro.
  await lancer(page, [12]);
  await attendreScore(page, 'Alice', 12);
  await expect(auTourDe(page)).toContainText('Bob');

  // Trois quilles : leur nombre, pas leur somme.
  await lancer(page, [1, 2, 3]);
  await attendreScore(page, 'Bob', 3);
  await expect(auTourDe(page)).toContainText('Alice');

  await lancer(page, [12]);
  await attendreScore(page, 'Alice', 24);

  // Un raté ne rapporte rien, mais il est compté.
  await page.getByRole('button', { name: /^Raté \(\d+\)$/ }).click();
  await attendreScore(page, 'Bob', 3);
  await expect(carte(page, 'Bob')).toHaveAccessibleName(/1 ratés/);
  await expect(auTourDe(page)).toContainText('Alice');

  // 24 + 1 = 25 : le score exact, la victoire.
  await lancer(page, [1]);

  const podium = page.getByRole('dialog');
  await expect(
    podium.getByRole('heading', { name: 'Victoire !' })
  ).toBeVisible();
  await expect(podium.getByText('Alice gagne la partie')).toBeVisible();
  const rangs = podium.getByRole('listitem');
  await expect(rangs).toHaveCount(2);
  await expect(rangs.nth(0)).toHaveText(/^1\s*Alice\s*25$/);
  await expect(rangs.nth(1)).toHaveText(/^2\s*Bob\s*3$/);
});

for (const theme of ['light', 'dark'] as const) {
  test.describe(`@a11y écran de partie — thème ${theme === 'light' ? 'clair' : 'sombre'}`, () => {
    // Le thème suit le système tant que rien n'est choisi : émuler la
    // préférence suffit, et c'est ce que vit un visiteur en mode sombre.
    test.use({ colorScheme: theme });

    test('consigne, annonce, quilles choisies et podium sans violation WCAG A/AA', async ({
      page,
    }) => {
      await demarrerPartie(page, ['Alice', 'Bob']);
      // Le thème est bien celui qu'on croit auditer.
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      // 1. Le premier lancement : la consigne s'affiche par-dessus l'écran.
      const consigne = page
        .getByRole('status')
        .filter({ hasText: 'Touchez les quilles tombées' });
      await expect(consigne).toBeVisible();
      await expectNoA11yViolations(page, AxeBuilder, expect);
      await consigne.getByRole('button', { name: 'Confirmer' }).click();
      await expect(consigne).toBeHidden();

      // 2. En cours de partie : un lancer joué (annuler et étoile actifs),
      //    une quille annoncée, puis des quilles tombées (bouton « Valider »
      //    actif, quilles pressées) — les états que l'écran d'arrivée ne
      //    montre pas.
      await lancer(page, [12]);
      await attendreScore(page, 'Alice', 12);
      await page.getByRole('button', { name: 'Annoncer', exact: true }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: '7', exact: true })
        .click();
      await expect(page.getByText('Tu annonces : quille 7')).toBeVisible();
      // Le sélecteur rouvert montre l'annonce en cours, en couleur d'accent.
      await page.getByRole('button', { name: 'Modifier', exact: true }).click();
      const selecteur = page.getByRole('dialog');
      await expect(
        selecteur.getByRole('button', { name: '7', exact: true, pressed: true })
      ).toBeVisible();
      await expectNoA11yViolations(page, AxeBuilder, expect);
      await selecteur.getByRole('button', { name: '7', exact: true }).click();
      await expect(selecteur).toBeHidden();
      await quille(page, 7).click();
      await quille(page, 9).click();
      await expect(
        page.getByRole('button', { name: /^Valider le tir/ })
      ).toBeEnabled();
      await expectNoA11yViolations(page, AxeBuilder, expect);

      // 3. Le podium, une fois la partie gagnée.
      await page.getByRole('button', { name: /^Valider le tir/ }).click();
      await lancer(page, [12]);
      await attendreScore(page, 'Alice', 24);
      await page.getByRole('button', { name: /^Raté \(\d+\)$/ }).click();
      await lancer(page, [1]);
      await expect(
        page.getByRole('dialog').getByRole('heading', { name: 'Victoire !' })
      ).toBeVisible();
      await expectNoA11yViolations(page, AxeBuilder, expect);
    });
  });
}
