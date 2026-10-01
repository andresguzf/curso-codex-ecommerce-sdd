import { z } from "zod";

const seedAccountSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
  password: z.string().min(12).max(128),
  role: z.enum(["ADMIN", "BILLING", "CUSTOMER"]),
});

export type SeedAccount = Readonly<z.infer<typeof seedAccountSchema>>;

export function validateSeedAccounts(accounts: readonly SeedAccount[]): SeedAccount[] {
  const parsed = z.array(seedAccountSchema).length(3).parse(accounts);
  if (new Set(parsed.map((account) => account.role)).size !== 3) {
    throw new Error("The development seed requires exactly one ADMIN, BILLING, and CUSTOMER account");
  }
  if (new Set(parsed.map((account) => account.email)).size !== 3) {
    throw new Error("Development seed account emails must be unique");
  }
  return parsed;
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test"]),
  DATABASE_URL: z.string().trim().url().startsWith("postgresql://"),
  SEED_ADMIN_EMAIL: z.string(),
  SEED_ADMIN_PASSWORD: z.string(),
  SEED_BILLING_EMAIL: z.string(),
  SEED_BILLING_PASSWORD: z.string(),
  SEED_CUSTOMER_EMAIL: z.string(),
  SEED_CUSTOMER_PASSWORD: z.string(),
});

/** No credential defaults and no implicit development mode. Validate before connecting. */
export function parseSeedEnvironment(environment: Record<string, string | undefined>) {
  if (environment.NODE_ENV === "production") {
    throw new Error("Development seed is disabled in production");
  }
  const parsed = environmentSchema.parse(environment);
  return {
    environment: parsed.NODE_ENV,
    databaseUrl: parsed.DATABASE_URL,
    accounts: validateSeedAccounts([
      { role: "ADMIN", email: parsed.SEED_ADMIN_EMAIL, password: parsed.SEED_ADMIN_PASSWORD, displayName: "DEMO - Development administrator" },
      { role: "BILLING", email: parsed.SEED_BILLING_EMAIL, password: parsed.SEED_BILLING_PASSWORD, displayName: "DEMO - Development billing manager" },
      { role: "CUSTOMER", email: parsed.SEED_CUSTOMER_EMAIL, password: parsed.SEED_CUSTOMER_PASSWORD, displayName: "DEMO - Development customer" },
    ]),
  };
}
