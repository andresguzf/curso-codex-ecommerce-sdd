/// <reference types="node" />

import { env } from "node:process";

import "dotenv/config";

import { defineConfig } from "drizzle-kit";
import { databaseConnectionOptions, DATABASE_TLS_WARNING } from "./src/database/connection-options";

const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required to generate, check, or run database migrations",
  );
}

const connection = databaseConnectionOptions(databaseUrl, env.DATABASE_TLS_VERIFY_SERVER ?? "true");
if (env.DATABASE_TLS_VERIFY_SERVER === "false") process.stderr.write(`${DATABASE_TLS_WARNING}\n`);
const parsedUrl = new URL(connection.connectionString!);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/schema/index.ts",
  out: "./src/database/migrations",
  dbCredentials: {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 5432),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: decodeURIComponent(parsedUrl.pathname.slice(1)),
    ssl: connection.ssl,
  },
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
  strict: true,
  verbose: true,
});
