import { describe, expect, it, vi } from "vitest";

import { protectSupabaseApplicationAccess, SUPABASE_APPLICATION_ACCESS_SQL } from "../../src/database/supabase-data-access.js";

describe("Supabase application access boundary", () => {
  it("does not modify local PostgreSQL", async () => {
    const query = vi.fn();
    await protectSupabaseApplicationAccess("postgresql://postgres:test@localhost/demo", { query });
    expect(query).not.toHaveBeenCalled();
  });
  it.each(["db.course.supabase.co", "aws-0-us-east-1.pooler.supabase.com"])("protects %s", async (host) => {
    const query = vi.fn().mockResolvedValue({});
    await protectSupabaseApplicationAccess(`postgresql://postgres:test@${host}:5432/postgres`, { query });
    expect(query).toHaveBeenCalledExactlyOnceWith(SUPABASE_APPLICATION_ACCESS_SQL);
  });
  it("uses RLS without policies or FORCE, scoped to application objects", () => {
    expect(SUPABASE_APPLICATION_ACCESS_SQL).toContain("ENABLE ROW LEVEL SECURITY");
    expect(SUPABASE_APPLICATION_ACCESS_SQL).not.toMatch(/CREATE POLICY|FORCE ROW LEVEL SECURITY|DROP|schema auth|schema storage/i);
    expect(SUPABASE_APPLICATION_ACCESS_SQL).toContain("FROM anon, authenticated, PUBLIC");
    expect(SUPABASE_APPLICATION_ACCESS_SQL).toContain("pg_policy");
  });
  it("fails closed when protection cannot be applied", async () => {
    const query = vi.fn().mockRejectedValue(new Error("permission denied"));
    await expect(protectSupabaseApplicationAccess("postgresql://postgres:test@db.course.supabase.co/postgres", { query })).rejects.toThrow("permission denied");
  });
});
