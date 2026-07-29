import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const packageVersion = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
) as { readonly version: string };

const crossOriginIsolationHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageVersion.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Nexora — Finanza personale",
        short_name: "Nexora",
        description: "Gestione finanziaria personale locale, privata e offline-first.",
        lang: "it",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f8f9ff",
        theme_color: "#0e3ec7",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ["**/*.{css,html,ico,js,png,svg,wasm,woff2}"],
        navigateFallback: "index.html",
        skipWaiting: true,
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    host: "127.0.0.1",
    headers: crossOriginIsolationHeaders,
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
