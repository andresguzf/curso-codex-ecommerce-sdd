import { afterEach, expect, it, vi } from "vitest";
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each(["development", "production", "test"])("limits local image optimization to development (%s)", async (environment) => {
  vi.stubEnv("NODE_ENV", environment); vi.resetModules();
  const { default: config } = await import("../next.config");
  expect(config.images?.dangerouslyAllowLocalIP).toBe(environment === "development");
  expect(config.images?.maximumRedirects).toBe(environment === "development" ? 0 : 3);
  expect(config.images?.remotePatterns).toContainEqual({ hostname: "localhost", pathname: "/api/v1/media/images/**", port: "3001", protocol: "http" });
});

it("limits Cloudinary optimization to unsigned catalog delivery paths", async () => {
  const { default: config } = await import("../next.config");
  const patterns = config.images?.remotePatterns ?? [];
  expect(hasRemoteMatch([], patterns, new URL("https://res.cloudinary.com/demo/image/upload/v123/codex-storefront/cover.png"))).toBe(true);
  for (const url of [
    "http://res.cloudinary.com/demo/image/upload/v123/codex-storefront/cover.png",
    "https://res.cloudinary.com:8443/demo/image/upload/v123/codex-storefront/cover.png",
    "https://res.cloudinary.com/demo/image/upload/v123/private/cover.png",
    "https://res.cloudinary.com/demo/video/upload/v123/codex-storefront/cover.png",
    "https://res.cloudinary.com/demo/image/upload/s--signed--/v123/codex-storefront/cover.png",
    "https://res.cloudinary.com/demo/image/upload/v123/codex-storefront/cover.png?api_secret=not-real",
    "https://evil.example/demo/image/upload/v123/codex-storefront/cover.png",
  ]) expect(hasRemoteMatch([], patterns, new URL(url)), url).toBe(false);
});
