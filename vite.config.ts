import {
  defineConfig,
  type Connect,
  type Plugin,
  type PluginOption,
  type ViteDevServer,
} from 'vite';
import type { ServerResponse } from 'node:http';
import { VitePWA } from 'vite-plugin-pwa';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pwaSeoPlugin } from '@mister-guiiug/dev-pwa-config/vite-pwa-base';
import { cspPlugin } from '@mister-guiiug/dev-pwa-config/vite-csp';
import { visualizer } from 'rollup-plugin-visualizer';
import { versionPlugin } from '@mister-guiiug/dev-pwa-config/vite-version';

const analyze = process.env.ANALYZE === '1';

export default defineConfig(({ command }) => {
  const envBase = process.env.VITE_BASE_PATH;
  const basePath = envBase ?? (command === 'build' ? '/mister-molkky/' : '/');
  // usePolling is required when running on a Windows NTFS mount via WSL:
  // inotify does not fire for /mnt/d/ paths, so Vite never detects saves.
  const usePolling =
    process.platform === 'linux' && process.env.WSL_DISTRO_NAME != null;

  return {
    base: basePath,
    server: {
      watch: {
        usePolling,
        interval: 300,
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        // @supabase/supabase-js source maps reference `shared/tracing`, a
        // monorepo-internal package not published to npm. Disabling sourcemaps
        // for pre-bundled deps avoids "Could not read source map" warnings.
        sourcemap: false,
      },
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          /*
           * LE MORCEAU SENTRY GARDE SON NOM, SANS EMPREINTE — parce qu'il est
           * exclu du précache (`globIgnores` plus bas) et qu'une URL empreintée
           * y meurt à chaque déploiement.
           *
           * Le service worker sert la coquille précachée jusqu'à ce que
           * l'utilisateur accepte la mise à jour ; cette coquille demande
           * l'ANCIENNE empreinte, que le déploiement suivant a supprimée de
           * `assets/`. Mesuré en production sur mister-qowa le 22/09/2026 :
           * HTTP 404, « Échec du chargement pour le module » dans la console.
           * `initSentry` avale l'échec (son `try/catch`), donc l'application ne
           * casse pas — elle rapporte ses erreurs à personne, sans le dire.
           *
           * Rien n'est perdu au cache : GitHub Pages répond
           * `Cache-Control: max-age=600` sur TOUS les fichiers, empreinte ou pas.
           *
           * `pwa-doctor` tient l'invariant depuis le socle 6.8.0
           * (règle `chunk-hors-precache`).
           */
          chunkFileNames: chunk =>
            chunk.name === 'sentry'
              ? 'assets/sentry.js'
              : 'assets/[name]-[hash].js',
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            const norm = id.replace(/\\/g, '/');
            // Sentry est chargé par un `import()` que `loader` rend
            // analysable. Sans cette ligne il tomberait dans `vendor`, qui
            // est PRÉCHARGÉ : mesuré sur miss-uwh, 381,9 kB préchargés au
            // lieu de 227,2 — pour un total gzip identique à 0,1 kB près.
            if (norm.includes('/@sentry/')) return 'sentry';
            // ET POSTHOG POUR LA MÊME RAISON, EN PLUS GRAVE. Sentry préchargé
            // coûtait du poids ; PostHog préchargé casse une PROMESSE : l'ADR
            // 0012 dit que rien n'est chargé avant l'accord, et le socle ne
            // l'appelle qu'après. Sans cette ligne, la bibliothèque tombe
            // dans `vendor`, qui est PRÉCHARGÉ — elle serait donc
            // téléchargée chez un visiteur qui refuse. C'est `preloadGzipKb`
            // qui le voit, jamais le total.
            if (norm.includes('/posthog-js/')) return 'posthog';
            if (
              norm.includes('/vite-plugin-pwa/') ||
              norm.includes('/workbox-')
            ) {
              return 'pwa';
            }
            if (
              norm.includes('/react-dom/') ||
              norm.includes('/node_modules/react/') ||
              norm.includes('/scheduler/')
            ) {
              return 'react-vendor';
            }
            if (norm.includes('/react-router/')) return 'router';
            if (norm.includes('/zustand/')) return 'zustand';
            if (norm.includes('/@rive-app/')) return 'rive';
            // These three are dynamically imported (live share QR, QR
            // scanner, Supabase client). Give each its OWN chunk so it
            // splits out as an on-demand async bundle — folding them into
            // the eager `vendor` catch-all below would defeat the lazy
            // import and ship them in the initial payload anyway.
            if (norm.includes('/qrcode/')) return 'qrcode';
            if (norm.includes('/qr-scanner/')) return 'qr-scanner';
            if (norm.includes('/@supabase/')) return 'supabase';
            if (
              norm.includes('/tailwindcss/') ||
              norm.includes('/@tailwindcss/')
            ) {
              return 'tailwind';
            }
            return 'vendor';
          },
        },
      },
    },
    plugins: [
      // AVANT cspPlugin : il pose un script inline dans le <head>, que la
      // CSP doit hacher après coup ; et il écrit version.json au build.
      versionPlugin({ manifest: true }),
      react(),
      tailwindcss(),
      // SEO partagé famille : canonical/OG via placeholders index.html +
      // sitemap.xml/robots.txt générés au build (source unique).
      pwaSeoPlugin({
        siteName: 'Mister Mölkky',
        basePath,
        logoPath: '/icons/icon-512.png',
        // Script anti-FOUC engendré par le socle (theme-boot), en remplacement
        // de l'IIFE recopiée dans index.html. `legacyKeys` doit rester aligné
        // sur THEME_LEGACY_KEYS (src/themeConfig.ts) : ce fichier s'exécute
        // côté Node, hors du projet TypeScript de l'app, il ne peut pas
        // l'importer. Deux valeurs divergentes = le script pose un thème que
        // React repeint aussitôt.
        themeBoot: { legacyKeys: ['mm_theme'] },
        // Deux <meta name="theme-color"> par schéma (attribut media) : la barre
        // du navigateur suit le système dès le premier rendu, sans le script
        // qui allait chercher la balise pour réécrire `content`. Le choix
        // explicite contraire au système est couvert par ThemeProvider.
        themeColor: { light: '#4a7c2a', dark: '#11140f' },
      }),
      // CSP durcie : script-src par hash SHA-256 du script anti-FOUC inline
      // (plus de 'unsafe-inline' en prod). Placé après pwaSeoPlugin pour hasher
      // le script que celui-ci injecte. Directives portées à l'identique depuis
      // l'ancienne meta statique de index.html.
      cspPlugin({
        dev: command === 'serve',
        // Ouvre les hôtes de PostHog — le nuage EUROPÉEN (ADR 0012). Sans
        // cette option, l'ingestion que `ConsentBanner` déclenche APRÈS
        // l'accord serait refusée par la politique — et l'échec ne se verrait
        // qu'en console, sur le site déployé, une fois le consentement donné.
        analytics: true,
        connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        extraDirectives: {
          'media-src': "'self' blob:",
          'frame-ancestors': "'none'",
        },
      }),
      // a SPA, that means deep links / route refreshes return the stock
      // "404 — File not found" instead of letting BrowserRouter take
      // over. Ship a 404.html that is byte-for-byte identical to
      // index.html — GH Pages serves it, the SPA boots, BrowserRouter
      // parses the URL and renders the right view.
      {
        name: 'mister-molkky-spa-404',
        apply: 'build',
        async closeBundle() {
          const { copyFile } = await import('node:fs/promises');
          const { resolve } = await import('node:path');
          const dist = resolve(process.cwd(), 'dist');
          try {
            await copyFile(
              resolve(dist, 'index.html'),
              resolve(dist, '404.html')
            );
          } catch (err) {
            console.warn('[spa-404] could not emit 404.html:', err);
          }
        },
      } satisfies Plugin,
      {
        name: 'mister-molkky-trailing-slash',
        configureServer(server: ViteDevServer) {
          server.middlewares.use(
            (
              req: Connect.IncomingMessage,
              res: ServerResponse,
              next: Connect.NextFunction
            ) => {
              const raw = req.originalUrl ?? '';
              const pathOnly = raw.split('?')[0] ?? '';
              if (pathOnly === '/mister-molkky') {
                const qs = raw.includes('?') ? `?${raw.split('?')[1]}` : '';
                res.statusCode = 302;
                res.setHeader('Location', `/mister-molkky/${qs}`);
                res.end();
                return;
              }
              next();
            }
          );
        },
      },
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'icons/icon-192.png',
          'icons/icon-512.png',
          'icons/apple-touch-icon.png',
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,webmanifest}'],
          /*
           * LE MORCEAU SENTRY HORS DU PRÉCACHE, sans quoi le découpage ne servirait
           * à rien : Workbox ramasse TOUT le JS émis, `import()` ou pas. Mesuré le
           * 16/09/2026 sur la production de deux apps du parc, 345 et 463 KiB de SDK
           * téléchargés par chaque visiteur, sans qu'aucun DSN soit posé.
           *
           * Hors précache, il est cherché sur le réseau à la première erreur, et
           * jamais si l'observabilité reste éteinte : rapporter une erreur demande
           * le réseau.
           */
          globIgnores: ['**/sentry.js', '**/sentry-*.js'],
        },
        manifest: {
          id: basePath,
          name: 'Mister Mölkky',
          short_name: 'Mister Mölkky',
          description:
            'Compteur de points et statistiques pour le jeu de Mölkky',
          theme_color: '#4a7c2a',
          background_color: '#f5f5f0',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: basePath,
          scope: basePath,
          lang: 'fr',
          categories: ['games', 'sports', 'utilities'],
          // UNE IMAGE PAR USAGE. Les deux PNG étaient déclarés
          // `any maskable` : la MÊME image servait au navigateur, qui la
          // montre telle quelle, et à Android, qui la rogne à son masque.
          // `logo.png` est une tuile arrondie sur fond gris clair — le
          // masque lui coupait les coins, et le fond clair faisait liseré.
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'icons/icon-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: 'screenshots/mobile.png',
              sizes: '824x1830',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'Écran d’accueil sur mobile',
            },
            {
              src: 'screenshots/wide.png',
              sizes: '2560x1600',
              type: 'image/png',
              form_factor: 'wide',
              label: 'Écran d’accueil sur ordinateur',
            },
          ],
        },
      }),
      analyze &&
        (visualizer({
          open: true,
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true,
        }) as PluginOption),
    ].filter(Boolean),
  };
});
