import { test, expect } from '@playwright/test';

test('@smoke home loads and renders the brand', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Mister Mölkky/);
  // `exact` : l'écran de bienvenue (premier lancement) contient aussi un
  // heading « Bienvenue dans Mister Mölkky » qui matcherait sans lui.
  await expect(
    page.getByRole('heading', { name: 'Mister Mölkky', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Nouvelle partie/i }).first()
  ).toBeVisible();
});

test('@smoke manifest is reachable', async ({ page }) => {
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe('Mister Mölkky');
  expect(manifest.start_url).toBeTruthy();
});
