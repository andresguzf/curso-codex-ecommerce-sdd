import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "@technology-ecommerce/config-testing/vitest";

export default mergeConfig(baseConfig, defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
}));
