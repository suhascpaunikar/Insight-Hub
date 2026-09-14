import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

/*
 * Four HTML entries, one per screen, because the console's navigation is real
 * page loads rather than a router — `navigate()` in the vanilla build set
 * `location.href`, and the URLs (`/builder.html`, `/insights.html`) are linked
 * from the README and from GitHub Pages. Keeping them as Rollup inputs keeps
 * those URLs working and keeps each screen's JS to its own chunk.
 *
 * `base` is the Pages project path. The site is served from
 * https://suhascpaunikar.github.io/Insight-Hub/, so every hashed asset has to
 * be requested under that prefix; the vanilla build got away with relative
 * hrefs, a bundle cannot.
 */
export default defineConfig({
  base: '/Insight-Hub/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        campaigns: resolve(import.meta.dirname, 'index.html'),
        builder: resolve(import.meta.dirname, 'builder.html'),
        insights: resolve(import.meta.dirname, 'insights.html'),
        settings: resolve(import.meta.dirname, 'settings.html'),
      },
    },
  },
});
