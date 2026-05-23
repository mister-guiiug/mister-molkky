import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { baseTestOptions } from '@mister-guiiug/dev-wpa-config/vitest-base';

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
