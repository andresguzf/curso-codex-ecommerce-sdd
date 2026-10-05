import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  roleAssignments,
  storeProfiles,
  users,
  type NewUser,
} from "../schema/index.js";
import * as schema from "../schema/index.js";
import { seedCatalog } from "./catalog-seed.js";
import { getDevelopmentProductImageManifest } from "./product-image-manifest.js";
import { hashSeedPassword, seedPasswordNeedsRehash, verifySeedPassword } from "./password.js";
import { validateSeedAccounts, type SeedAccount } from "./seed-config.js";

export type { SeedAccount } from "./seed-config.js";

type SeedEnvironment = "development" | "test" | "production";
type SeedRole = SeedAccount["role"];

export type DevelopmentSeedOptions = Readonly<{
  accounts: readonly SeedAccount[];
  databaseUrl: string;
  environment: SeedEnvironment;
}>;

export type DevelopmentSeedResult = Readonly<{
  categories: number;
  tags: number;
  productTags: number;
  inventoryBalances: number;
  inventoryMovements: number;
  productImages: number;
  products: number;
  roleAssignments: number;
  storeProfiles: number;
  users: number;
}>;

const DEMO_STORE_PROFILE = {
  tradeName: "DEMO - Nexo Tech",
  legalName: "DEMO - Nexo Tecnología Sociedad Ficticia",
  taxIdentifier: "DEMO-NO-VALIDO",
  addressLine1: "DEMO - Calle Ejemplo 123",
  addressLine2: null,
  addressCity: "DEMO - Ciudad Ejemplo",
  addressRegion: "DEMO - Región Ejemplo",
  addressPostalCode: "0000000",
  addressCountryCode: "CL",
  contactEmail: "demo@example.invalid",
  contactPhone: null,
  logoStorageKey: null,
  logoUrl: null,
  logoSha256: null,
} as const;

export async function runDevelopmentSeed(
  options: DevelopmentSeedOptions,
): Promise<DevelopmentSeedResult> {
  if (options.environment === "production") {
    throw new Error("Development seed is disabled in production");
  }

  getDevelopmentProductImageManifest(options.environment);
  const accounts = validateSeedAccounts(options.accounts);

  const pool = new Pool({
    application_name: "technology-ecommerce-development-seed",
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  const database = drizzle({ client: pool, schema });

  try {
    return await database.transaction(async (transaction) => {
      await transaction.execute(sql`select pg_advisory_xact_lock(2042026)`);
      const seededUserIds = new Map<SeedRole, string>();

      for (const account of accounts) {
        const normalizedEmail = account.email.trim().toLowerCase();
        const [existingUser] = await transaction
          .select({ id: users.id, passwordHash: users.passwordHash })
          .from(users)
          .where(sql`lower(${users.email}) = ${normalizedEmail}`)
          .limit(1);
        const passwordHash =
          existingUser &&
          !seedPasswordNeedsRehash(existingUser.passwordHash) &&
          (await verifySeedPassword(account.password, existingUser.passwordHash))
            ? existingUser.passwordHash
            : await hashSeedPassword(account.password);
        const userValues: NewUser = {
          email: normalizedEmail,
          passwordHash,
          displayName: account.displayName,
          status: "ACTIVE",
          deletedAt: null,
          updatedAt: new Date(),
        };

        const [seededUser] = existingUser
          ? await transaction
              .update(users)
              .set(userValues)
              .where(sql`${users.id} = ${existingUser.id}`)
              .returning({ id: users.id })
          : await transaction
              .insert(users)
              .values(userValues)
              .returning({ id: users.id });

        if (!seededUser) {
          throw new Error(`Could not persist the ${account.role} seed account`);
        }

        seededUserIds.set(account.role, seededUser.id);
      }

      const adminUserId = seededUserIds.get("ADMIN");

      if (!adminUserId) {
        throw new Error("Development seed did not produce an administrator");
      }

      for (const account of accounts) {
        const userId = seededUserIds.get(account.role);

        if (!userId) {
          throw new Error(`Development seed did not produce ${account.role}`);
        }

        await transaction
          .insert(roleAssignments)
          .values({
            userId,
            role: account.role,
            assignedByUserId: adminUserId,
          })
          .onConflictDoUpdate({
            target: roleAssignments.userId,
            set: {
              role: account.role,
              assignedByUserId: adminUserId,
              updatedAt: new Date(),
            },
          });
      }

      await transaction
        .insert(storeProfiles)
        .values(DEMO_STORE_PROFILE)
        .onConflictDoNothing({ target: storeProfiles.id });

      const catalog = await seedCatalog(transaction, options.environment, adminUserId);

      return {
        users: seededUserIds.size,
        roleAssignments: seededUserIds.size,
        ...catalog,
        storeProfiles: 1,
      };
    });
  } finally {
    await pool.end();
  }
}
