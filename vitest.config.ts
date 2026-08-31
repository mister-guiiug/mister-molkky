import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import {
  baseTestOptions,
  coveragePreset,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

const pwaRegisterDouble = fileURLToPath(
  import.meta.resolve('@mister-guiiug/dev-wpa-config/testing/pwa-register')
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // vite-plugin-pwa injecte ce module virtuel au dev/build. Vitest ne
      // passe pas par le plugin : sans alias, tout test qui tire un module
      // important `virtual:pwa-register` échoue À LA RÉSOLUTION, avant
      // d'avoir rien éprouvé — c'est pourquoi le `vi.mock` de vitest-setup
      // ne suffit pas, il n'agit qu'à l'exécution.
      //
      // La cible est le double PILOTABLE du socle : `swStub.needRefresh()`
      // rejoue ce que fait un vrai service worker quand une version attend,
      // et LÈVE si personne n'a injecté `registerSW`. L'ancien stub maison
      // (src/test/stub-pwa-register.ts) était muet : il prouvait qu'un
      // composant se monte, jamais qu'un bandeau peut s'afficher.
      //
      // ATTENTION : `vitest-setup` du même paquet pose un
      // `vi.mock('virtual:pwa-register')` MUET qui, résolu à travers cet
      // alias, désigne le même fichier et l'écrase. Un test qui veut piloter
      // le double doit donc écrire `vi.unmock('virtual:pwa-register')` en
      // tête de fichier (voir SocleUpdates.test.tsx).
      'virtual:pwa-register': pwaRegisterDouble,
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
