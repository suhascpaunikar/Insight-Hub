import path from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const here = path.dirname(fileURLToPath(import.meta.url))

// The prototype around this app is a zero-build static site: GitHub Pages and
// Netlify both publish the repository as it stands. So the dashboard builds to
// a committed bundle under assets/, at fixed filenames the root index.html can
// name, and every other page keeps working untouched.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
      // The campaign store and the seed data are shared with the vanilla pages:
      // one source of truth, so a campaign published in the builder shows up here.
      "@proto": path.resolve(here, "..", "assets", "js"),
    },
  },
  // The two aliases above reach outside the app directory; dev needs to serve them.
  server: { fs: { allow: [path.resolve(here, "..")] } },
  build: {
    outDir: path.resolve(here, "..", "assets", "dashboard"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(here, "src", "main.tsx"),
      output: {
        entryFileNames: "dashboard.js",
        chunkFileNames: "[name].js",
        assetFileNames: (asset) =>
          asset.names?.[0]?.endsWith(".css") ? "dashboard.css" : "[name]-[hash][extname]",
      },
    },
  },
})
