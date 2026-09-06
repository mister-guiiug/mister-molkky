import { defineConfig, devices } from '@playwright/test';
import { definePwaPlaywrightConfig } from '@mister-guiiug/dev-pwa-config/playwright-base';

// La factory fournit la matrice 5 navigateurs, les reporters multi-format,
// le snapshotPathTemplate, reducedMotion et le webServer (cf. dev-pwa-config 1.3.0).
// `preview: true` (dev-pwa-config 3.x) : les e2e testent un BUILD de prod
// (service worker, minification, cache réels). VITE_BASE_PATH=/ neutralise le
// base path GitHub Pages pour servir l'app à la racine du serveur local.
export default defineConfig(
  definePwaPlaywrightConfig({
    devices,
    testMatch: /.*\.spec\.ts$/,
    preview: true,
    // Port 4173 (défaut `vite preview`) : ne collisionne pas avec un dev
    // server (5173) éventuellement lancé à côté.
    port: 4173,
    command:
      'cross-env VITE_BASE_PATH=/ npm run build && cross-env VITE_BASE_PATH=/ vite preview --port 4173 --strictPort',
    // LA LANGUE DU NAVIGATEUR EST FIXÉE, PAS SUBIE. Les specs sont écrites en
    // français (« Nouvelle partie », « Joueurs »…) et l'app suit
    // `navigator.language` : lancée depuis un poste ou un runner en `en-US`,
    // elle rend « New match » et quatre tests sur neuf échouent sur un
    // « element(s) not found » qui ne dit rien de la cause. Personne ne le
    // voyait — `.github/workflows/ci.yml` passe `run-e2e: false`.
    // `overrides` FUSIONNE `use` (socle ≥ 3.x) : le `baseURL` calculé par la
    // fabrique survit.
    overrides: { use: { locale: 'fr-FR' } },
  })
);
