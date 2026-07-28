import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
