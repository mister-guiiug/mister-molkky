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
import { visualizer } from 'rollup-plugin-visualizer';

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
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            const norm = id.replace(/\\/g, '/');
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
      react(),
      tailwindcss(),
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
          'robots.txt',
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2,webmanifest}'],
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
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
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
