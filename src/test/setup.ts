import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// vite-plugin-pwa injects `virtual:pwa-register` at build time. In the
// vitest runner we never go through Vite's PWA plugin, so this import
// would fail and crash any test that pulls in register-sw.ts (directly
// or transitively via SettingsView). Stub it with a noop registerSW.
vi.mock('virtual:pwa-register', () => ({
  registerSW: () => () => Promise.resolve(),
}));
