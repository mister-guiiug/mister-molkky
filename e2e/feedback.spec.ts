import { test, expect } from '@playwright/test';

/**
 * LA PORTE DE SORTIE, DANS UN VRAI BUILD (V4 de VALEUR.md).
 *
 * Le test unitaire d'`AppFooter` POSE `__DWC_BUILD__` à la main : sous Vitest
 * il n'y a pas de build, donc il éprouve le câblage du composant, pas la
 * chaîne. Or c'est justement le build qui injecte ce global (`vite-version` du
 * socle) et qui écrit `version.json`. Un lien « Signaler un problème » sans
 * version dedans ne vaut guère mieux qu'un raccourci vers l'onglet Issues :
 * c'est ce que ce test-ci vérifie, et lui seul peut le faire.
 */
test('@smoke le pied de page mène au gabarit de signalement, version remplie', async ({
  page,
}) => {
  await page.goto('/');

  const link = page.getByRole('link', { name: /signaler un problème/i });
  await expect(link).toBeVisible();

  const href = await link.getAttribute('href');
  const url = new URL(href ?? '');
  expect(url.origin + url.pathname).toBe(
    'https://github.com/mister-guiiug/mister-molkky/issues/new'
  );
  expect(url.searchParams.get('template')).toBe('bug.yml');
  // Ce que le build a injecté, et que le rendu jsdom ne peut pas prouver.
  expect(url.searchParams.get('version')).toBeTruthy();
  expect(url.searchParams.get('environnement')).toContain('écran');
});

test('@smoke version.json est servi à côté de l’app', async ({ page }) => {
  // Le socle sonde ce fichier pour proposer la mise à jour ; il est produit
  // par le build (`vite-version`) et sa présence n'est vérifiée nulle part
  // ailleurs.
  const response = await page.request.get('/version.json');
  expect(response.ok()).toBeTruthy();
  const version = await response.json();
  expect(version.version).toBeTruthy();
});
