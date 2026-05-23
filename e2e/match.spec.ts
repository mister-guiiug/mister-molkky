import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mm_settings', JSON.stringify({
        state: { hasSeenWelcome: true, locale: 'fr', sounds: false, vibrations: false, wakeLock: false },
        version: 1,
      }));
    } catch {}
  });
});

test('@critical can play a 3-player match end to end', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Nouvelle partie/i }).first().click();

  for (const name of ['Alice', 'Bob', 'Carol']) {
    await page.getByPlaceholder(/Prénom du joueur/i).fill(name);
    await page.getByRole('button', { name: /Ajouter un joueur/i }).click();
  }

  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByRole('button', { name: '50', exact: true }).click();
  await page.getByRole('button', { name: /Suivant/i }).click();
  await page.getByRole('button', { name: /Démarrer la partie/i }).click();

  await expect(page.getByText(/Au tour de/i)).toBeVisible();

  for (let i = 0; i < 12; i += 1) {
    await page.getByRole('button', { name: /Raté/i }).click();
    await page.waitForTimeout(60);
  }

  await expect(page.getByText(/Victoire/i)).toBeVisible({ timeout: 8000 });
});
