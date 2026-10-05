import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { beforeAll, expect, it } from "vitest";

beforeAll(() => {
  // Build the current sources, including on a clean checkout without dist/.
  const build = spawnSync("pnpm", ["build"], {
    cwd: process.cwd(), timeout: 30_000, encoding: "utf8",
  });
  expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
}, 35_000);

it("loads compiled NestJS through ESM even when require(ESM) is disabled", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  expect(packageJson.type).toBe("module");
  const main = await readFile("dist/main.js", "utf8");
  expect(main).toContain('from "@nestjs/config"');
  expect(main).not.toContain('require("@nestjs/config")');

  const script = `
    import { Pool } from 'pg';
    import { NestFactory } from '@nestjs/core';
    import { ConfigService } from '@nestjs/config';
    import { FastifyAdapter } from '@nestjs/platform-fastify';
    import { createHash } from 'node:crypto';
    Pool.prototype.connect = async function () { throw new Error('Offline smoke forbids database access'); };
    Pool.prototype.query = function () { throw new Error('Offline smoke forbids database access'); };
    const { AppModule } = await import('./dist/app.module.js');
    const { DatabaseService } = await import('./dist/database/database.service.js');
    const { configureApplication } = await import('./dist/application.js');
    const { BUNDLED_CATALOG_KEY, BUNDLED_CATALOG_SHA256 } = await import('./dist/product-catalog/image-storage/bundled-catalog-image.js');
    const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false, abortOnError: false });
    try {
      if (app.get(ConfigService).get('VERCEL') !== '1') throw new Error('Invalid smoke environment');
      // Exercise HTTP initialization without the readiness query or local timers.
      app.get(DatabaseService).onApplicationBootstrap = async () => {};
      configureApplication(app);
      await app.init();
      const server = app.getHttpAdapter().getInstance();
      const logo = await server.inject({ method: 'GET', url: '/api/v1/media/images/company-logo-v1.svg' });
      if (logo.statusCode !== 200 || !logo.body.includes('<svg')) throw new Error('SVG route failed');
      const image = await server.inject({ method: 'GET', url: '/api/v1/media/images/' + BUNDLED_CATALOG_KEY });
      if (image.statusCode !== 200 || createHash('sha256').update(image.rawPayload).digest('hex') !== BUNDLED_CATALOG_SHA256) throw new Error('Bundled image route failed');
      console.log('ESM_HTTP_SMOKE_OK');
    } finally { await app.close(); }
  `;
  const result = spawnSync(process.execPath,
    ["--no-experimental-require-module", "--input-type=module", "-e", script], {
      cwd: process.cwd(), timeout: 20_000, encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production", VERCEL: "1", VERCEL_ENV: "production",
        DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline",
        DATABASE_TLS_VERIFY_SERVER: "true", AUTH_COOKIE_SECURE: "true",
        AUTH_ACCESS_TOKEN_SECRET: "offline-test-secret-of-at-least-32-characters",
        CRON_SECRET: "offline-test-cron-secret-at-least-32-characters",
        CORS_ALLOWED_ORIGINS: "https://store.example,https://admin.example",
        IMAGE_STORAGE_CATALOG_PROVIDER: "cloudinary", CLOUDINARY_FOLDER_MODE: "dynamic",
        CLOUDINARY_CLOUD_NAME: "offline-cloud", CLOUDINARY_API_KEY: "offline-key",
        CLOUDINARY_API_SECRET: "offline-secret",
        IMAGE_STORAGE_PUBLIC_BASE_URL: "https://api.example/api/v1/media/images" },
    });
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(result.stdout).toContain("ESM_HTTP_SMOKE_OK");
});
