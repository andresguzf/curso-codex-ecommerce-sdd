import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import "dotenv/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "../../src/database/schema";
import { storeProfiles } from "../../src/database/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for store profile persistence tests");

const testDatabaseName = `ecommerce_store_profile_${randomUUID().replaceAll("-", "")}`;
if (!/^ecommerce_store_profile_[a-f0-9]{32}$/.test(testDatabaseName)) {
  throw new Error("Generated an unsafe PostgreSQL test database name");
}
const quotedDatabaseName = `"${testDatabaseName}"`;
const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const isolatedUrl = new URL(databaseUrl);
isolatedUrl.pathname = `/${testDatabaseName}`;

let maintenancePool: Pool | undefined;
let testPool: Pool | undefined;
let createdDatabase = false;
let database: NodePgDatabase<typeof schema>;

const validProfile = {
  tradeName: "Tecnología Central",
  legalName: "Tecnología Central SpA",
  taxIdentifier: "76.123.456-7",
  addressLine1: "Av. Principal 123",
  addressCity: "Santiago",
  addressCountryCode: "CL",
};

describe("store profile persistence", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({ connectionString: maintenanceUrl.toString(), max: 1 });
    await maintenancePool.query(`create database ${quotedDatabaseName} template template0`);
    createdDatabase = true;

    testPool = new Pool({ connectionString: isolatedUrl.toString(), max: 2 });
    database = drizzle({ client: testPool, schema });
    await migrate(database, {
      migrationsFolder: resolve("src/database/migrations"),
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
  }, 30_000);

  afterAll(async () => {
    await testPool?.end();
    if (maintenancePool && createdDatabase) {
      await maintenancePool.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
        [testDatabaseName],
      );
      await maintenancePool.query(`drop database ${quotedDatabaseName}`);
    }
    await maintenancePool?.end();
  }, 30_000);

  it("permits exactly one profile with the required identity and structured address", async () => {
    const [saved] = await database.insert(storeProfiles).values(validProfile).returning();
    expect(saved).toMatchObject({ id: 1, ...validProfile, logoStorageKey: null, logoUrl: null });
    await expect(database.insert(storeProfiles).values(validProfile)).rejects.toMatchObject({
      cause: { code: "23505", constraint: "store_profiles_pkey" },
    });
    await expect(database.insert(storeProfiles).values({ ...validProfile, id: 2 })).rejects.toMatchObject({
      cause: { code: "23514", constraint: "store_profiles_singleton" },
    });
  });

  it.each([
    ["tradeName", "store_profiles_trade_name_not_blank"],
    ["legalName", "store_profiles_legal_name_not_blank"],
    ["taxIdentifier", "store_profiles_tax_identifier_not_blank"],
    ["addressLine1", "store_profiles_address_line_1_not_blank"],
    ["addressCity", "store_profiles_address_city_not_blank"],
  ] as const)("rejects a blank %s in PostgreSQL", async (field, constraint) => {
    await expect(database.insert(storeProfiles).values({ ...validProfile, [field]: "   " })).rejects.toMatchObject({
      cause: { code: "23514", constraint },
    });
  });

  it("rejects missing required fields, invalid country code and incomplete logo references", async () => {
    await expect(testPool!.query(
      "insert into store_profiles (trade_name, legal_name, tax_identifier, address_line_1, address_country_code) values ($1, $2, $3, $4, $5)",
      ["Store", "Legal Store", "123", "Main Street", "CL"],
    )).rejects.toMatchObject({ code: "23502", column: "address_city" });
    await expect(database.insert(storeProfiles).values({ ...validProfile, addressCountryCode: "cl" })).rejects.toMatchObject({
      cause: { code: "23514", constraint: "store_profiles_address_country_code_format" },
    });
    await expect(database.insert(storeProfiles).values({ ...validProfile, logoStorageKey: "logos/store.svg" })).rejects.toMatchObject({
      cause: { code: "23514", constraint: "store_profiles_logo_reference_complete" },
    });
  });
});
