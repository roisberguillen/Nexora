import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const packageVersion = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
) as { readonly version: string };

const crossOriginIsolationHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws://127.0.0.1:5173 https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
    "worker-src 'self' blob:",
  ].join("; "),
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
      registerType: "prompt",
      injectRegister: null,
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
        clientsClaim: false,
        globPatterns: ["**/*.{css,html,ico,js,png,svg,wasm,woff2}"],
        navigateFallback: "index.html",
        skipWaiting: false,
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    headers: crossOriginIsolationHeaders,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    headers: crossOriginIsolationHeaders,
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
