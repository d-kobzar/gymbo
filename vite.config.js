import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vanilla JS + plain CSS bundler for the Mini App front-end.
 *
 * - `public/` is the source root (index.html + modules + styles).
 * - Build output goes to `public/dist/`, which NestJS serves alongside
 *   the unbundled files (legacy `js/*.js` and `css/style.css` still
 *   work during Phase 5 — Phase 6 replaces each page gradually).
 * - CSS entry `styles/index.css` @imports tokens → reset → base →
 *   components and Vite emits a single hashed bundle.
 * - JS entry `js/app.js` (Phase 6 will wire this to the new components;
 *   for now it just pulls the CSS so the build produces both assets).
 */
export default defineConfig({
  root: resolve(__dirname, 'public'),
  base: '/dist/',
  publicDir: false,
  build: {
    outDir: resolve(__dirname, 'public/dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        styles: resolve(__dirname, 'public/styles/index.css'),
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
