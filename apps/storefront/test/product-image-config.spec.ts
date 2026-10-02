import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each(["development", "production", "test"])("limits local image optimization to development (%s)", async (environment) => {
  vi.stubEnv("NODE_ENV", environment); vi.resetModules();
  const { default: config } = await import("../next.config");
  expect(config.images?.dangerouslyAllowLocalIP).toBe(environment === "development");
  expect(config.images?.maximumRedirects).toBe(environment === "development" ? 0 : 3);
  expect(config.images?.remotePatterns).toContainEqual({ hostname: "localhost", pathname: "/api/v1/media/images/**", port: "3001", protocol: "http" });
});
