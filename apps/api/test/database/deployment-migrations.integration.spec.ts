import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import "dotenv/config";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runDatabaseMigrations } from "../../src/database/migration-runner";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for PostgreSQL integration tests");
}

const databaseNames = [
  `ecommerce_deploy_empty_${randomUUID().replaceAll("-", "")}`,
  `ecommerce_deploy_recovery_${randomUUID().replaceAll("-", "")}`,
] as const;

for (const databaseName of databaseNames) {
  if (!/^ecommerce_deploy_(?:empty|recovery)_[a-f0-9]{32}$/.test(databaseName)) {
    throw new Error("Generated an unsafe PostgreSQL test database name");
  }
}

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";

const databaseUrls = databaseNames.map((databaseName) => {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
});

const migrationsFolder = resolve("src/database/migrations");
let maintenancePool: Pool | undefined;
let failureMigrationsFolder: string | undefined;

async function createFailureMigrations(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "ecommerce-failed-migration-"));
  await mkdir(join(folder, "meta"));
  await writeFile(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({
      dialect: "postgresql",
      entries: [
        {
          breakpoints: true,
          idx: 0,
          tag: "0000_intentional_failure",
          version: "7",
          when: 1,
        },
      ],
      version: "7",
    }),
  );
  await writeFile(
    join(folder, "0000_intentional_failure.sql"),
    [
      "create table migration_failure_probe (id integer primary key);",
      "--> statement-breakpoint",
      "select * from intentionally_missing_relation;",
    ].join("\n"),
  );
  return folder;
}

describe("deployment database migrations", () => {
  beforeAll(async () => {
    maintenancePool = new Pool({
      application_name: "technology-ecommerce-deployment-test-admin",
      connectionString: maintenanceUrl.toString(),
      max: 1,
    });

    for (const databaseName of databaseNames) {
      await maintenancePool.query(`create database "${databaseName}" template template0`);
    }

    failureMigrationsFolder = await createFailureMigrations();
  }, 30_000);

  afterAll(async () => {
    if (maintenancePool) {
      for (const databaseName of databaseNames) {
        await maintenancePool.query(
          "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
          [databaseName],
        );
        await maintenancePool.query(`drop database if exists "${databaseName}"`);
      }
    }

    await maintenancePool?.end();

    if (failureMigrationsFolder) {
      await rm(failureMigrationsFolder, { force: true, recursive: true });
    }
  }, 30_000);

  it("migrates an empty PostgreSQL database to the current schema", async () => {
    await runDatabaseMigrations({
      databaseUrl: databaseUrls[0]!,
      migrationsFolder,
    });

    const pool = new Pool({ connectionString: databaseUrls[0], max: 1 });
    const migrationResult = await pool.query<{ migrationCount: string }>(
      'select count(*) as "migrationCount" from drizzle.__drizzle_migrations',
    );
    const schemaResult = await pool.query<{ usersTable: string | null }>(
      `select to_regclass('public.users')::text as "usersTable"`,
    );
    await pool.end();

    expect(Number(migrationResult.rows[0]?.migrationCount)).toBeGreaterThan(0);
    expect(schemaResult.rows[0]?.usersTable).toBe("users");
  });

  it("rolls back a failed migration and recovers with the valid migration set", async () => {
    await expect(
      runDatabaseMigrations({
        databaseUrl: databaseUrls[1]!,
        migrationsFolder: failureMigrationsFolder!,
      }),
    ).rejects.toBeDefined();

    const pool = new Pool({ connectionString: databaseUrls[1], max: 1 });
    const failedState = await pool.query<{ probeTable: string | null }>(
      `select to_regclass('public.migration_failure_probe')::text as "probeTable"`,
    );
    expect(failedState.rows[0]?.probeTable).toBeNull();

    await runDatabaseMigrations({
      databaseUrl: databaseUrls[1]!,
      migrationsFolder,
    });

    const recoveredState = await pool.query<{ usersTable: string | null }>(
      `select to_regclass('public.users')::text as "usersTable"`,
    );
    await pool.end();

    expect(recoveredState.rows[0]?.usersTable).toBe("users");
  });
});
