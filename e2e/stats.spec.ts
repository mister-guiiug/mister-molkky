import { test, expect } from '@playwright/test';

test('stats page renders the empty state when no matches', async ({ page }) => {
  await page.goto('/statistiques');
  await expect(page.getByRole('heading', { name: /Statistiques/i })).toBeVisible();
  await expect(page.getByText(/Pas encore de données/i)).toBeVisible();
});

test('history page renders the empty state', async ({ page }) => {
  await page.goto('/historique');
  await expect(page.getByRole('heading', { name: /Historique/i })).toBeVisible();
  await expect(page.getByText(/Aucune partie terminée/i)).toBeVisible();
});

test('players page renders the empty state', async ({ page }) => {
  await page.goto('/joueurs');
  await expect(page.getByRole('heading', { name: /Joueurs/i })).toBeVisible();
});
