import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import {
  baseTestOptions,
  coveragePreset,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

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
  test: {
    ...baseTestOptions,
    coverage: {
      ...coveragePreset,
      // Le .d.ts du preset élargit `provider` à `string` ; on le re-fixe au
      // littéral attendu par Vitest (contextuellement contraint à 'v8').
      provider: 'v8',
      // Scope enforced coverage to the pure game-logic domain — the part
      // where a regression is most dangerous (silent mis-scoring). UI and
      // the live/sync stores are intentionally excluded so the gate stays
      // meaningful rather than diluted by hard-to-unit-test surface.
      include: ['src/molkky/**'],
      // A regression FLOOR set just below current coverage — ratchet these
      // up as new tests land; never lower them to make a red run green.
      thresholds: {
        statements: 65,
        branches: 80,
        functions: 70,
        lines: 65,
      },
    },
  },
});
