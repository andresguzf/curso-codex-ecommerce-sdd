import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TLSSocket } from "node:tls";
import { parse } from "dotenv";
import { Pool } from "pg";

import { databaseConnectionOptions } from "../../src/database/connection-options.js";

async function main(): Promise<void> {
  const privateEnvironment = parse(await readFile(resolve(".env.vercel-preflight")));
  const uri = privateEnvironment.DATABASE_URL;
  if (!uri) throw new Error("Missing private preflight DATABASE_URL");
  const url = new URL(uri);
  if (!url.hostname.endsWith(".pooler.supabase.com") || url.port !== "5432") {
    throw new Error("Copy the exact Supabase Session pooler URI on port 5432");
  }
  // Inherit only the already explicit local TLS policy, never its active URI.
  const localEnvironment = parse(await readFile(resolve(".env")));
  const verify = privateEnvironment.DATABASE_TLS_VERIFY_SERVER
    ?? localEnvironment.DATABASE_TLS_VERIFY_SERVER ?? "true";
  const pool = new Pool({ ...databaseConnectionOptions(uri, verify), max: 2,
    connectionTimeoutMillis: 10_000, query_timeout: 10_000 });
  const key = `vercel-preflight:${randomUUID()}`;
  try {
    const first = await pool.connect();
    try {
      const second = await pool.connect();
      try {
        // pg_stat_ssl describes pooler -> PostgreSQL, not this client -> pooler.
        const socket = (first as unknown as { connection: { stream: TLSSocket } }).connection.stream;
        if (socket.encrypted !== true) throw new Error("TLS is required");
        const acquired = await first.query<{ locked: boolean }>(
          "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked", [key],
        );
        const excluded = await second.query<{ locked: boolean }>(
          "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked", [key],
        );
        if (!acquired.rows[0]?.locked || excluded.rows[0]?.locked !== false) {
          throw new Error("Session lock exclusion failed");
        }
        await first.query("select pg_advisory_unlock(hashtextextended($1, 0))", [key]);
        const released = await second.query<{ locked: boolean }>(
          "select pg_try_advisory_lock(hashtextextended($1, 0)) as locked", [key],
        );
        if (!released.rows[0]?.locked) throw new Error("Session lock release failed");
        console.log(JSON.stringify({ sessionPooler5432: true, tlsEncrypted: true,
          verifyServer: verify === "true", exclusiveSessionLock: true,
          releaseVerified: true, maxRuntimeConnectionsPerInstance: 4 }));
      } finally {
        await second.query("select pg_advisory_unlock(hashtextextended($1, 0))", [key]);
        second.release();
      }
    } finally {
      await first.query("select pg_advisory_unlock(hashtextextended($1, 0))", [key]);
      first.release();
    }
  } finally { await pool.end(); }
}

void main().catch((error: unknown) => {
  // A remote error can contain the URI; deliberately never print the exception.
  console.error("Private Vercel preflight failed. Check URI, TLS policy and connectivity locally; no data was modified.");
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "PREFLIGHT_CHECK_FAILED";
  if (/^[A-Z0-9_]{1,64}$/.test(code)) console.error(`Diagnostic code: ${code}`);
  process.exitCode = 1;
});
