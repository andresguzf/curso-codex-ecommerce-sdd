import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./frontend",
  outputDir: "../test-results/frontends",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "storefront",
      testMatch: [/storefront-(catalog|accessibility|theme|design)\.spec\.ts/, /theme-components\.spec\.ts/, /theme-regression\.spec\.ts/],
      use: { baseURL: "http://localhost:3000" },
    },
    {
      name: "backoffice",
      testMatch: [/backoffice-(catalog|accessibility|theme|design|dashboard)\.spec\.ts/, /theme-components\.spec\.ts/, /theme-regression\.spec\.ts/],
      use: { baseURL: "http://localhost:3002" },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @technology-ecommerce/storefront dev",
      url: "http://localhost:3000",
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001",
      },
    },
    {
      command: "pnpm --filter @technology-ecommerce/backoffice dev",
      url: "http://localhost:3002",
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001",
        NEXT_PUBLIC_API_URL: "http://localhost:3001/api/v1",
        NEXT_PUBLIC_STOREFRONT_URL: "http://localhost:3000",
      },
    },
  ],
});
