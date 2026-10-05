import { describe, expect, it, vi } from "vitest";

import { parseSeedEnvironment, validateSeedAccounts } from "../../src/database/seed/seed-config.js";
import { executeDevelopmentSeed } from "../../src/database/seed/seed-runner.js";

// Test-only credentials, never connected to a real development database.
const environment = {
  NODE_ENV: "test", DATABASE_URL: "postgresql://test:TestDatabasePassword@localhost/isolated_seed_test",
  SEED_ADMIN_EMAIL: " Admin@Example.invalid ", SEED_ADMIN_PASSWORD: "TestOnlyAdminPassword123!",
  SEED_BILLING_EMAIL: "billing@example.invalid", SEED_BILLING_PASSWORD: "TestOnlyBillingPassword123!",
  SEED_CUSTOMER_EMAIL: "customer@example.invalid", SEED_CUSTOMER_PASSWORD: "TestOnlyCustomerPassword123!",
};
const result = {
  categories: 4, tags: 2, productTags: 40, inventoryBalances: 20, inventoryMovements: 20,
  productImages: 60, products: 20, roleAssignments: 3, storeProfiles: 1, users: 3,
};

describe("non-production seed configuration and safe logs", () => {
  it("requires explicit configuration, normalizes emails and preserves the three existing roles", () => {
    const options = parseSeedEnvironment(environment);
    expect(options.environment).toBe("test");
    expect(options.accounts.map((account) => account.role)).toEqual(["ADMIN", "BILLING", "CUSTOMER"]);
    expect(options.accounts[0]?.email).toBe("admin@example.invalid");
    expect(options.accounts.every((account) => account.displayName.startsWith("DEMO -"))).toBe(true);
    expect(parseSeedEnvironment({ ...environment, NODE_ENV: "development" }).environment).toBe("development");
  });

  it.each([undefined, "", "production", "staging"])("rejects environment %s before running the seed", async (NODE_ENV) => {
    const run = vi.fn().mockResolvedValue(result);
    const logger = { info: vi.fn(), error: vi.fn() };
    expect(await executeDevelopmentSeed({ ...environment, NODE_ENV }, logger, run)).toBe(1);
    expect(run).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it.each([
    { SEED_ADMIN_PASSWORD: undefined }, { SEED_CUSTOMER_PASSWORD: "short" },
    { SEED_CUSTOMER_PASSWORD: "x".repeat(129) }, { SEED_ADMIN_EMAIL: "not-an-email" },
    { SEED_CUSTOMER_EMAIL: " ADMIN@EXAMPLE.INVALID " }, { DATABASE_URL: "https://example.invalid" },
  ])("rejects invalid accounts or database configuration before running", async (override) => {
    const run = vi.fn().mockResolvedValue(result);
    const logger = { info: vi.fn(), error: vi.fn() };
    expect(await executeDevelopmentSeed({ ...environment, ...override }, logger, run)).toBe(1);
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects duplicate roles in direct callers", () => {
    const accounts = parseSeedEnvironment(environment).accounts;
    expect(() => validateSeedAccounts(accounts.map((account) => ({ ...account, role: "ADMIN" })))).toThrow();
  });

  it("logs only allowlisted counters on success and never credentials or environment", async () => {
    const run = vi.fn().mockResolvedValue({ ...result, password: environment.SEED_ADMIN_PASSWORD });
    const logger = { info: vi.fn(), error: vi.fn() };
    expect(await executeDevelopmentSeed(environment, logger, run)).toBe(0);
    const log = logger.info.mock.calls[0]?.[0] as string;
    expect(JSON.parse(log)).toEqual({
      event: "database.seed.completed", level: "info", products: 20, productImages: 60,
      roleAssignments: 3, storeProfiles: 1, users: 3,
    });
    for (const value of Object.values(environment)) expect(log).not.toContain(value);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("does not log error messages, stack traces, database URLs or passwords on failure", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const run = vi.fn().mockRejectedValue(new Error(JSON.stringify(environment)));
    expect(await executeDevelopmentSeed(environment, logger, run)).toBe(1);
    expect(JSON.parse(logger.error.mock.calls[0]?.[0] as string)).toEqual({
      event: "database.seed.failed", level: "error", errorType: "Error",
    });
    const serialized = JSON.stringify(logger.error.mock.calls);
    for (const value of Object.values(environment)) expect(serialized).not.toContain(value);
  });
});
