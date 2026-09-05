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
  })
);
