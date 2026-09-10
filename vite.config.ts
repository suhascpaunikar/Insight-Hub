import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * The three screens that are not the homepage are still the original no-build
 * prototype: plain HTML importing `assets/js/*.js` as ES modules. Vite never
 * sees them — `index.html` is the only rollup input — so they are copied into
 * the build byte-for-byte rather than bundled. That is deliberate: the Kumo
 * work is scoped to the homepage, and a page nobody asked me to touch should
 * not come out of this with different bytes than it went in with.
 */
function copyLegacyPrototype(): Plugin {
  const files = [
    'builder.html',
    'insights.html',
    'settings.html',
    'assets',
    'docs',
    '.nojekyll',
  ];
  return {
    name: 'insighthub:copy-legacy-prototype',
    apply: 'build',
    closeBundle() {
      const out = resolve(import.meta.dirname, 'dist');
      for (const file of files) {
        const from = resolve(import.meta.dirname, file);
        if (existsSync(from)) cpSync(from, resolve(out, file), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyLegacyPrototype()],
  // `assets/` at the repo root is the legacy prototype's own folder and is
  // copied into the build as-is, so Vite's emitted chunks go somewhere else
  // rather than landing on top of it.
  build: { assetsDir: 'static', outDir: 'dist', emptyOutDir: true },
  publicDir: false,
});
