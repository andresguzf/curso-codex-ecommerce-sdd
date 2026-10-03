import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Isolate Next output and processes from the user's running applications.
export default defineConfig({
  ...base,
  outputDir: "../test-results/image-delivery",
  projects: base.projects?.map((project) => ({
    ...project,
    use: {
      ...project.use,
      baseURL: project.name === "storefront" ? "http://localhost:3200" : "http://localhost:3202",
    },
  })),
  webServer: [
    {
      command: "pnpm --filter @technology-ecommerce/storefront exec next dev --port 3200",
      url: "http://localhost:3200",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        E2E_NEXT_DIST_DIR: ".next-image-delivery-e2e",
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001",
      },
    },
    {
      command: "pnpm --filter @technology-ecommerce/backoffice exec next dev --port 3202",
      url: "http://localhost:3202/login",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        E2E_NEXT_DIST_DIR: ".next-image-delivery-e2e",
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001",
        NEXT_PUBLIC_API_URL: "http://localhost:3001/api/v1",
        NEXT_PUBLIC_STOREFRONT_URL: "http://localhost:3200",
      },
    },
  ],
});
