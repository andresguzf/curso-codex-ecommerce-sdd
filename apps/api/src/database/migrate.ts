import { resolve } from "node:path";
import { env, stderr, stdout } from "node:process";

import { runDatabaseMigrations } from "./migration-runner";

function requiredDatabaseUrl(): string {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run database migrations");
  }

  return databaseUrl;
}

async function main(): Promise<void> {
  const migrationsFolder = resolve(
    env.DATABASE_MIGRATIONS_PATH ?? "src/database/migrations",
  );

  stdout.write(
    `${JSON.stringify({
      event: "database.migration.started",
      level: "info",
      timestamp: new Date().toISOString(),
    })}\n`,
  );

  await runDatabaseMigrations({
    databaseUrl: requiredDatabaseUrl(),
    migrationsFolder,
  });

  stdout.write(
    `${JSON.stringify({
      event: "database.migration.completed",
      level: "info",
      timestamp: new Date().toISOString(),
    })}\n`,
  );
}

void main().catch((error: unknown) => {
  const errorCode =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;

  stderr.write(
    `${JSON.stringify({
      errorCode,
      errorName: error instanceof Error ? error.name : "UnknownError",
      event: "database.migration.failed",
      level: "error",
      message: "Database migration failed; API startup aborted",
      timestamp: new Date().toISOString(),
    })}\n`,
  );
  process.exitCode = 1;
});
