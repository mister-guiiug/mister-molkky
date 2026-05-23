/**
 * Stub for `virtual:pwa-register`. Vite injects the real virtual module
 * via vite-plugin-pwa at dev/build time; in vitest we alias the import
 * to this file so register-sw.ts can be imported by any view test
 * without needing the PWA plugin in the test runner.
 */
export function registerSW(): () => Promise<void> {
  return () => Promise.resolve();
}
