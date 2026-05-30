import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';

// Inlined from @mister-guiiug/dev-wpa-config/vitest-base — the published
// package's subpath exports weren't reliably resolvable on CI, so we
// keep the base options here to avoid that build-blocking dep.
const baseTestOptions = {
  environment: 'jsdom' as const,
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
  passWithNoTests: true,
  coverage: {
    provider: 'v8' as const,
    // Scope enforced coverage to the pure game-logic domain — the part
    // where a regression is most dangerous (silent mis-scoring). UI and
    // the live/sync stores are intentionally excluded so the gate stays
    // meaningful rather than diluted by hard-to-unit-test surface.
    include: ['src/molkky/**'],
    reporter: ['text', 'html'],
    // A regression FLOOR set just below current coverage — ratchet these
    // up as new tests land; never lower them to make a red run green.
    thresholds: {
      statements: 65,
      branches: 80,
      functions: 70,
      lines: 65,
    },
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // vite-plugin-pwa injects this virtual module at dev/build time.
      // In vitest we never go through that plugin, so any test that
      // pulls register-sw.ts (directly or transitively via SettingsView)
      // would fail to resolve the import. Point it at a tiny stub.
      'virtual:pwa-register': resolve(
        __dirname,
        'src/test/stub-pwa-register.ts'
      ),
    },
  },
  test: baseTestOptions,
});
