import { access } from "node:fs/promises";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const MIGRATION_LOCK_ID = "84110420260211";

export type DatabaseMigrationOptions = Readonly<{
  databaseUrl: string;
  migrationsFolder: string;
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
}: DatabaseMigrationOptions): Promise<void> {
  await access(join(migrationsFolder, "meta", "_journal.json"));

  const pool = new Pool({
    application_name: "technology-ecommerce-api-migrations",
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    max: 1,
  });

  try {
    await pool.query("select pg_advisory_lock($1::bigint)", [MIGRATION_LOCK_ID]);

    const database = drizzle({ client: pool });
    await migrate(database, {
      migrationsFolder,
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
  } finally {
    await pool.end();
  }
}
