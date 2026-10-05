import { describe, expect, it } from "vitest";

import { databaseConnectionOptions } from "../../src/database/connection-options";
import { validateEnvironment } from "../../src/config/environment";

const remote = "postgresql://postgres:private-password@db.course.supabase.co:5432/postgres";

describe("PostgreSQL TLS policy", () => {
  it("preserves local non-TLS development", () => {
    expect(databaseConnectionOptions("postgresql://postgres:test@localhost:5432/test").ssl).toBe(false);
  });
  it("verifies remote identity by default even with sslmode=require", () => {
    const config = databaseConnectionOptions(`${remote}?sslmode=require`);
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
    expect(config.connectionString).not.toContain("sslmode");
  });
  it("allows explicit course opt-in without global changes", () => {
    const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    expect(databaseConnectionOptions(remote, false).ssl).toEqual({ rejectUnauthorized: false });
    expect(databaseConnectionOptions(remote, "false").ssl).toEqual({ rejectUnauthorized: false });
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(previous);
  });
  it("accepts course opt-in with NODE_ENV=production", () => {
    expect(validateEnvironment({ DATABASE_URL: remote, NODE_ENV: "production",
      AUTH_ACCESS_TOKEN_SECRET: "course-demo-secret-at-least-32-characters",
      DATABASE_TLS_VERIFY_SERVER: "false" }).DATABASE_TLS_VERIFY_SERVER).toBe(false);
  });
  it("accepts session pooling", () => {
    expect(databaseConnectionOptions("postgresql://postgres.course:test@aws-0-us-east-1.pooler.supabase.com:5432/postgres").ssl)
      .toEqual({ rejectUnauthorized: true });
  });
  it("rejects transaction pooling and plaintext remote connections", () => {
    expect(() => databaseConnectionOptions(remote.replace(":5432", ":6543"))).toThrow("session");
    expect(() => databaseConnectionOptions(`${remote}?sslmode=disable`, false)).toThrow("TLS");
  });
  it("rejects malformed configuration without leaking credentials", () => {
    expect(() => databaseConnectionOptions("not-a-url-private-password")).toThrow("valid PostgreSQL URL");
    expect(() => databaseConnectionOptions(remote, "no")).toThrow("true or false");
    expect(() => validateEnvironment({ DATABASE_URL: remote, DATABASE_TLS_VERIFY_SERVER: "no" })).toThrow("DATABASE_TLS_VERIFY_SERVER");
  });
});
