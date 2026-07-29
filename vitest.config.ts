import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const packageVersion = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { readonly version: string };

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageVersion.version),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
