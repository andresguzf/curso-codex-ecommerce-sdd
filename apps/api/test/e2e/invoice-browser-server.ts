/** Real REST server for Playwright; all writes target a disposable database. */
import { randomUUID } from "node:crypto";
import { insertProductFixtures } from "../product-fixtures";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import * as schema from "../../src/database/schema";
import { hashPassword } from "../../src/identity-access/password/password";
import { installControlledCloudinary } from "./controlled-cloudinary";

const loadCompiled = createRequire(resolve("test/e2e/invoice-browser-server.ts"));
if (process.env.NODE_ENV === "production") throw new Error("Browser test fixtures cannot run in production");
const databaseName = `ecommerce_invoice_browser_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_invoice_browser_[a-f0-9]{32}$/.test(databaseName)) throw new Error("Unsafe test database name");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for browser E2E tests");
const maintenanceUrl = new URL(process.env.DATABASE_URL);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(process.env.DATABASE_URL);
isolatedUrl.pathname = `/${databaseName}`;
const maintenance = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
let created = false;
let fixturePool: Pool | undefined;
let app: NestFastifyApplication | undefined;
let stopping = false;
let imageRoot: string | undefined;

async function stop() {
  if (stopping) return;
  stopping = true;
  await app?.close();
  await fixturePool?.end();
  if (imageRoot) await rm(imageRoot, { recursive: true, force: true });
  if (created) {
    await maintenance.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [databaseName]);
    await maintenance.query(`drop database "${databaseName}"`);
  }
  await maintenance.end();
}

async function start() {
  await maintenance.query(`create database "${databaseName}" template template0`);
  created = true;
  fixturePool = new Pool({ connectionString: isolatedUrl.toString(), max: 2 });
  const database = drizzle({ client: fixturePool, schema });
  await migrate(database, { migrationsFolder: resolve("src/database/migrations"), migrationsSchema: "drizzle", migrationsTable: "__drizzle_migrations" });
  const passwordHash = await hashPassword("InvoiceBrowserPassword123!");
  for (const role of ["ADMIN", "BILLING", "CUSTOMER"] as const) {
    const [user] = await database.insert(schema.users).values({ email: `${role.toLowerCase()}@invoice.example.test`, displayName: `E2E ${role}`, passwordHash }).returning();
    await database.insert(schema.roleAssignments).values({ userId: user!.id, role });
  }
  for (let index = 1; index <= 25; index++) {
    const label = String(index).padStart(2, "0");
    const [customer] = await database.insert(schema.users).values({ email: `demo${label}@invoice.example.test`, displayName: `Cliente Demo ${label}`, passwordHash }).returning();
    await database.insert(schema.roleAssignments).values({ userId: customer!.id, role: "CUSTOMER" });
    await insertProductFixtures(database, { sku: `E2E-KEY-${label}`, name: `Teclado Demo ${label}`, description: "Teclado para pruebas de facturación", price: "89.50", status: "ACTIVE" }, () => ({ storageKey: `e2e/keyboard-${label}`, url: "/images/product-placeholder.svg" }));
  }
  await database.insert(schema.storeProfiles).values({ tradeName: "E2E DEMO", legalName: "E2E DEMO Company", taxIdentifier: "DEMO-NOT-VALID", addressLine1: "Demo Street", addressCity: "Demo City", addressCountryCode: "US" });
  await fixturePool.end();
  fixturePool = undefined;

  process.env.DATABASE_URL = isolatedUrl.toString();
  process.env.NODE_ENV = "test";
  process.env.AUTH_ACCESS_TOKEN_SECRET = "invoice-browser-test-secret-at-least-32-characters";
  process.env.AUTH_COOKIE_SECURE = "false";
  process.env.CORS_ALLOWED_ORIGINS = "http://localhost:3102,http://localhost:3100";
  imageRoot = await mkdtemp(resolve(tmpdir(), "ecommerce-browser-images-"));
  process.env.IMAGE_STORAGE_LOCAL_ROOT = imageRoot;
  process.env.IMAGE_STORAGE_PUBLIC_BASE_URL = "http://localhost:3001/api/v1/media/images";
  // Never inherit real provider credentials in normal browser tests.
  const cloudTest = process.env.E2E_CONTROLLED_CLOUDINARY === "true";
  process.env.IMAGE_STORAGE_CATALOG_PROVIDER = cloudTest ? "cloudinary" : "local";
  process.env.CLOUDINARY_CLOUD_NAME = cloudTest ? "browser-test" : "";
  process.env.CLOUDINARY_API_KEY = cloudTest ? "controlled-key" : "";
  process.env.CLOUDINARY_API_SECRET = cloudTest ? "controlled-secret" : "";
  process.env.CLOUDINARY_FOLDER_MODE = cloudTest ? "dynamic" : "";
  const cloud = cloudTest ? installControlledCloudinary() : undefined;
  const { AppModule } = loadCompiled("../../dist/app.module");
  const { configureApplication } = loadCompiled("../../dist/application");
  app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  configureApplication(app);
  if (cloud) {
    const { LocalImageStorage } = loadCompiled("../../dist/product-catalog/image-storage/local-image-storage");
    const { CatalogImageRecoveryService } = loadCompiled("../../dist/product-catalog/image-storage/catalog-image-recovery.service");
    const localImage = await app.get(LocalImageStorage).upload({ mimeType: "image/png", data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWNgYGjAgQZQAgDw8BgBXuIwQQAAAABJRU5ErkJggg==", "base64") });
    const http = app.getHttpAdapter().getInstance();
    // These diagnostics exist only in this loopback test executable, not AppModule.
    http.get("/__e2e/cloudinary", async () => ({ ...cloud.stats(), localImage }));
    http.post<{ Body: { mode: string } }>("/__e2e/cloudinary/control", async (request) => { cloud.control(request.body.mode); return { ok: true }; });
    http.post("/__e2e/cloudinary/reconcile", async () => {
      await app!.get(CatalogImageRecoveryService).reconcile(new Date(Date.now() + 120_001));
      return { ok: true };
    });
    http.get<{ Params: { id: string } }>("/__e2e/cloudinary/media/:id", async (request, reply) => {
      const bytes = cloud.bytes(request.params.id);
      return bytes ? reply.type("image/png").send(bytes) : reply.code(404).send();
    });
  }
  await app.listen({ port: 3101, host: "127.0.0.1" });
}

for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => {
  void stop().then(() => process.exit(0));
});
void start().catch(async (error: unknown) => {
  // Never print connection strings or fixture credentials.
  process.stderr.write(`Invoice browser test server failed: ${error instanceof Error ? error.name : "unknown error"}\n`);
  await stop();
  process.exit(1);
});
