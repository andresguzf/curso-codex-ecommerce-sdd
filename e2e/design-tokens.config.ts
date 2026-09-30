import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./frontend",
  testMatch: /design-tokens\.spec\.ts/,
  outputDir: "../test-results/design-tokens",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
});
