import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { crossOriginIsolationHeaders, googleOAuthBridgeHeaders } from "./securityHeaders";

const googleOAuthBridgePath = "/google-drive-oauth-bridge.html";

function googleOAuthBridgePlugin() {
  const applyHeaders = (server: {
    readonly middlewares: {
      use(
        handler: (
          request: { readonly url?: string },
          response: { setHeader(name: string, value: string): void },
          next: () => void,
        ) => void,
      ): void;
    };
  }) => {
    server.middlewares.use((request, response, next) => {
      const headers =
        request.url?.split("?", 1)[0] === googleOAuthBridgePath
          ? googleOAuthBridgeHeaders
          : crossOriginIsolationHeaders;
      for (const [name, value] of Object.entries(headers)) {
        response.setHeader(name, value);
      }
      next();
    });
  };
  return {
    name: "nexora-google-oauth-bridge-headers",
    configureServer: applyHeaders,
    configurePreviewServer: applyHeaders,
  };
}

const packageVersion = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
) as { readonly version: string };

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageVersion.version),
  },
  plugins: [
    react(),
    googleOAuthBridgePlugin(),
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
        navigateFallbackDenylist: [/^\/google-drive-oauth-bridge\.html(?:\?.*)?$/],
        navigateFallback: "index.html",
        skipWaiting: false,
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
