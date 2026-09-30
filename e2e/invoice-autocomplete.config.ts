import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./frontend",
  testMatch: /invoice-autocomplete\.spec\.ts/,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3102", trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm --filter @technology-ecommerce/api build && pnpm --filter @technology-ecommerce/api exec tsx test/e2e/invoice-browser-server.ts",
      url: "http://127.0.0.1:3101/api/v1/health", reuseExistingServer: false, timeout: 120_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    },
    {
      command: "pnpm --filter @technology-ecommerce/backoffice build && pnpm --filter @technology-ecommerce/backoffice exec next start --port 3102",
      url: "http://localhost:3102/login", reuseExistingServer: false, timeout: 120_000,
      env: { E2E_NEXT_DIST_DIR: ".next-invoice-e2e", NEXT_PUBLIC_API_BASE_URL: "http://localhost:3101", NEXT_PUBLIC_API_URL: "http://localhost:3101/api/v1", NEXT_PUBLIC_STOREFRONT_URL: "http://localhost:3000" },
    },
  ],
});
