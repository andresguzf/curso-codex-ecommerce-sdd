import { defineConfig } from "@playwright/test";
import base from "./product-gallery.config";

export default defineConfig({
  ...base,
  testMatch: /cloudinary-gallery-real\.spec\.ts/,
  outputDir: "../test-results/cloudinary-gallery-real",
  webServer: Array.isArray(base.webServer) ? base.webServer.map((server, index) => index === 0
    ? { ...server, env: { ...server.env, E2E_CONTROLLED_CLOUDINARY: "true" } }
    : server) : base.webServer,
});
