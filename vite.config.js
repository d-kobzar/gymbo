import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vanilla JS + plain CSS bundler for the Mini App front-end.
 *
 * - `public/` is the source root (index.html + JS modules + styles).
 * - Build output → `public/dist/assets/`, served by NestJS static.
 * - Two entries:
 *    * `app` (js/app.js) — imports core, components, pages, and the
 *      CSS bundle. Emits a single JS module the HTML loads directly.
 *    * `styles` (styles/index.css) — kept separate so we can link it
 *      from <head> before the JS runs, preventing FOUC.
 * - Fixed output names (no content hash) to keep `index.html` static.
 *   Cache-busting is delegated to HTTP cache-control headers —
 *   simpler than regenerating the HTML each build.
 */
export default defineConfig({
  root: resolve(__dirname, 'public'),
  base: '/dist/',
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'public/dist'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'public/js/app.js'),
        styles: resolve(__dirname, 'public/styles/index.css'),
      },
      output: {
        assetFileNames: 'assets/[name][extname]',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        format: 'es',
      },
    },
  },
});
