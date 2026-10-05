import { access } from "node:fs/promises";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { databaseConnectionOptions, DATABASE_TLS_WARNING } from "./connection-options.js";
import { protectSupabaseApplicationAccess } from "./supabase-data-access.js";

const MIGRATION_LOCK_ID = "84110420260211";

export type DatabaseMigrationOptions = Readonly<{
  databaseUrl: string;
  migrationsFolder: string;
  tlsVerifyServer?: boolean | string;
}>;

/**
 * Runs every pending migration before the HTTP process starts. A session-level
 * advisory lock serializes deployments that point multiple API replicas at the
 * same database. The single-connection pool ensures the lock and migration
 * transaction use the same PostgreSQL session.
 */
export async function runDatabaseMigrations({
  databaseUrl,
  migrationsFolder,
  tlsVerifyServer = true,
}: DatabaseMigrationOptions): Promise<void> {
  await access(join(migrationsFolder, "meta", "_journal.json"));

  const pool = new Pool({
    application_name: "technology-ecommerce-api-migrations",
    ...databaseConnectionOptions(databaseUrl, tlsVerifyServer),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    max: 1,
  });
  if (tlsVerifyServer === false || tlsVerifyServer === "false") {
    process.stderr.write(`${DATABASE_TLS_WARNING}\n`);
  }

  try {
    await pool.query("select pg_advisory_lock($1::bigint)", [MIGRATION_LOCK_ID]);

    // Remove automatic public grants before DDL; keep Data API enabled.
    await protectSupabaseApplicationAccess(databaseUrl, pool);

    const database = drizzle({ client: pool });
    await migrate(database, {
      migrationsFolder,
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
    // Apply RLS and explicit object grants before any application data import.
    await protectSupabaseApplicationAccess(databaseUrl, pool);
  } finally {
    await pool.end();
  }
}
