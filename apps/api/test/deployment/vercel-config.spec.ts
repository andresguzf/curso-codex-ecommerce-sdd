import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import type { ExecutionContext } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { assertDeploymentRuntime } from "../../src/config/deployment-runtime";
import { validateEnvironment } from "../../src/config/environment";
import { AuthCookieService } from "../../src/identity-access/auth-cookie.service";
import { CsrfGuard } from "../../src/identity-access/csrf.guard";

afterEach(() => vi.unstubAllEnvs());

describe("course Vercel configuration", () => {
  it("preserves exact origins and Secure/HttpOnly host-only refresh cookies", () => {
    const environment = validateEnvironment({ DATABASE_URL: "postgresql://postgres:test@localhost:5432/test",
      NODE_ENV: "production", AUTH_ACCESS_TOKEN_SECRET: "test-secret-with-at-least-32-characters",
      AUTH_COOKIE_SAME_SITE: "lax", CORS_ALLOWED_ORIGINS: "https://store.example,https://admin.example" });
    expect(environment.CORS_ALLOWED_ORIGINS).toEqual(["https://store.example", "https://admin.example"]);
    const setCookie = vi.fn();
    const reply = { setCookie, header: vi.fn() } as unknown as FastifyReply;
    new AuthCookieService(new ConfigService(environment)).setSessionCookies(reply, "private-test-refresh");
    expect(setCookie.mock.calls[0]?.[2]).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/api/v1/auth" });
    expect(setCookie.mock.calls[0]?.[2]).not.toHaveProperty("domain");
  });

  it("continues requiring matching CSRF cookie and header for cookie operations", () => {
    const context = (header?: string) => ({ switchToHttp: () => ({ getRequest: () => ({
      cookies: { "XSRF-TOKEN": "test-token" }, headers: { "x-csrf-token": header },
    }) }) }) as unknown as ExecutionContext;
    const guard = new CsrfGuard();
    expect(guard.canActivate(context("test-token"))).toBe(true);
    expect(() => guard.canActivate(context())).toThrow();
    expect(() => guard.canActivate(context("other-token"))).toThrow();
  });
  it("rejects manual previews before runtime initialization", () => {
    expect(() => assertDeploymentRuntime({ VERCEL: "1", VERCEL_ENV: "preview" })).toThrow();
    expect(() => assertDeploymentRuntime({ VERCEL: "1", VERCEL_ENV: "production" })).not.toThrow();
    expect(() => assertDeploymentRuntime({})).not.toThrow();
  });

  it("uses independent project roots, region and reproducible builds without cron activation", async () => {
    for (const app of ["api", "storefront", "backoffice"]) {
      const config = JSON.parse(await readFile(resolve(process.cwd(), `../${app}/vercel.json`), "utf8"));
      expect(config.framework).toBe(app === "api" ? "nestjs" : "nextjs");
      expect(config.regions).toEqual(["iad1"]);
      expect(config.installCommand).toBe("pnpm install --frozen-lockfile");
      expect(config.buildCommand).toBe("pnpm build");
      expect(config.ignoreCommand).toContain("production");
      expect(config.crons).toBeUndefined();
      if (app === "api") expect(config.functions["src/main.ts"].maxDuration).toBe(300);
    }
  });

  for (const app of ["storefront", "backoffice"] as const) {
    it(`${app}: REST rewrites preserve local behavior and reject invalid origins`, async () => {
      const configPath = resolve(process.cwd(), `../${app}/next.config.ts`);
      const config = (await import(configPath)).default as {
        rewrites: () => Promise<unknown>;
      };
      vi.stubEnv("VERCEL", "0");
      vi.stubEnv("API_REST_ORIGIN", "");
      expect(await config.rewrites!()).toEqual([]);
      vi.stubEnv("VERCEL", "1");
      await expect(config.rewrites!()).rejects.toThrow("required");
      vi.stubEnv("API_REST_ORIGIN", "https://course-api.example");
      expect(await config.rewrites!()).toEqual([{ source: "/api/v1/:path*", destination: "https://course-api.example/api/v1/:path*" }]);
      for (const origin of ["http://localhost:3001", "https://user:password@api.example", "https://api.example/path"]) {
        vi.stubEnv("API_REST_ORIGIN", origin);
        await expect(config.rewrites!()).rejects.toThrow();
      }
    });
  }
});
