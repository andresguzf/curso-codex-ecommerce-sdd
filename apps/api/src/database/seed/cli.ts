import process from "node:process";

import "dotenv/config";
import { z } from "zod";

import { runDevelopmentSeed } from "./development-seed";

const seedEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().trim().startsWith("postgresql://"),
    SEED_ADMIN_EMAIL: z.email(),
    SEED_ADMIN_PASSWORD: z.string().min(12),
    SEED_BILLING_EMAIL: z.email(),
    SEED_BILLING_PASSWORD: z.string().min(12),
    SEED_CUSTOMER_EMAIL: z.email(),
    SEED_CUSTOMER_PASSWORD: z.string().min(12),
  })
  .refine(
    (environment) =>
      new Set([
        environment.SEED_ADMIN_EMAIL.toLowerCase(),
        environment.SEED_BILLING_EMAIL.toLowerCase(),
        environment.SEED_CUSTOMER_EMAIL.toLowerCase(),
      ]).size === 3,
    { message: "Seed account emails must be different" },
  );

async function main(): Promise<void> {
  const environment = seedEnvironmentSchema.parse(process.env);
  const result = await runDevelopmentSeed({
    databaseUrl: environment.DATABASE_URL,
    environment: environment.NODE_ENV,
    accounts: [
      {
        role: "ADMIN",
        email: environment.SEED_ADMIN_EMAIL,
        password: environment.SEED_ADMIN_PASSWORD,
        displayName: "Development administrator",
      },
      {
        role: "BILLING",
        email: environment.SEED_BILLING_EMAIL,
        password: environment.SEED_BILLING_PASSWORD,
        displayName: "Development billing manager",
      },
      {
        role: "CUSTOMER",
        email: environment.SEED_CUSTOMER_EMAIL,
        password: environment.SEED_CUSTOMER_PASSWORD,
        displayName: "Development customer",
      },
    ],
  });

  console.info(
    JSON.stringify({
      event: "database.seed.completed",
      level: "info",
      products: result.products,
      roleAssignments: result.roleAssignments,
      users: result.users,
    }),
  );
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      errorType: error instanceof Error ? error.name : "UnknownError",
      event: "database.seed.failed",
      level: "error",
    }),
  );
  process.exitCode = 1;
});
