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
