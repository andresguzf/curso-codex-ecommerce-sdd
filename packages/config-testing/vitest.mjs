import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    passWithNoTests: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
