import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  inventoryBalances,
  inventoryMovements,
  productImages,
  products,
  roleAssignments,
  users,
  type NewUser,
} from "../schema";
import * as schema from "../schema";
import { hashSeedPassword, verifySeedPassword } from "./password";

type SeedEnvironment = "development" | "test" | "production";
type SeedRole = "ADMIN" | "BILLING" | "CUSTOMER";

export type SeedAccount = Readonly<{
  displayName: string;
  email: string;
  password: string;
  role: SeedRole;
}>;

export type DevelopmentSeedOptions = Readonly<{
  accounts: readonly SeedAccount[];
  databaseUrl: string;
  environment: SeedEnvironment;
}>;

export type DevelopmentSeedResult = Readonly<{
  inventoryBalances: number;
  inventoryMovements: number;
  productImages: number;
  products: number;
  roleAssignments: number;
  users: number;
}>;

const DEVELOPMENT_PRODUCTS = [
  {
    sku: "DEV-LAPTOP-001",
    name: "Development Ultrabook 14",
    description:
      "Portable development notebook with a high-resolution display and modern connectivity.",
    price: "1299.90",
    currency: "USD",
    status: "ACTIVE" as const,
    imageStorageKey: "development/products/dev-laptop-001/cover.webp",
    imageUrl: "https://picsum.photos/id/0/1200/900.webp",
    availableQuantity: 12,
  },
  {
    sku: "DEV-MONITOR-001",
    name: "Development Monitor 27",
    description:
      "Twenty-seven inch monitor for development workflows and detailed visual work.",
    price: "499.90",
    currency: "USD",
    status: "ACTIVE" as const,
    imageStorageKey: "development/products/dev-monitor-001/cover.webp",
    imageUrl: "https://picsum.photos/id/60/1200/900.webp",
    availableQuantity: 8,
  },
  {
    sku: "DEV-KEYBOARD-001",
    name: "Development Mechanical Keyboard",
    description:
      "Compact mechanical keyboard prepared as inactive catalog data for administrative testing.",
    price: "149.90",
    currency: "USD",
    status: "INACTIVE" as const,
    imageStorageKey: "development/products/dev-keyboard-001/cover.webp",
    imageUrl: "https://picsum.photos/id/2/1200/900.webp",
    availableQuantity: 20,
  },
] as const;

const REQUIRED_ROLES = new Set<SeedRole>(["ADMIN", "BILLING", "CUSTOMER"]);

function validateSeedAccounts(accounts: readonly SeedAccount[]): void {
  const roles = new Set(accounts.map(({ role }) => role));
  const normalizedEmails = accounts.map(({ email }) => email.trim().toLowerCase());

  if (
    accounts.length !== REQUIRED_ROLES.size ||
    roles.size !== REQUIRED_ROLES.size ||
    [...REQUIRED_ROLES].some((role) => !roles.has(role))
  ) {
    throw new Error(
      "The development seed requires exactly one ADMIN, BILLING, and CUSTOMER account",
    );
  }

  if (new Set(normalizedEmails).size !== normalizedEmails.length) {
    throw new Error("Development seed account emails must be unique");
  }
}

export async function runDevelopmentSeed(
  options: DevelopmentSeedOptions,
): Promise<DevelopmentSeedResult> {
  if (options.environment === "production") {
    throw new Error("Development seed is disabled in production");
  }

  validateSeedAccounts(options.accounts);

  const pool = new Pool({
    application_name: "technology-ecommerce-development-seed",
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 1,
  });
  const database = drizzle({ client: pool, schema });

  try {
    return await database.transaction(async (transaction) => {
      const seededUserIds = new Map<SeedRole, string>();

      for (const account of options.accounts) {
        const normalizedEmail = account.email.trim().toLowerCase();
        const [existingUser] = await transaction
          .select({ id: users.id, passwordHash: users.passwordHash })
          .from(users)
          .where(sql`lower(${users.email}) = ${normalizedEmail}`)
          .limit(1);
        const passwordHash =
          existingUser &&
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

      for (const account of options.accounts) {
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

      for (const productSeed of DEVELOPMENT_PRODUCTS) {
        const [existingProduct] = await transaction
          .select({ id: products.id })
          .from(products)
          .where(sql`upper(${products.sku}) = ${productSeed.sku}`)
          .limit(1);
        const productValues = {
          sku: productSeed.sku,
          name: productSeed.name,
          description: productSeed.description,
          price: productSeed.price,
          currency: productSeed.currency,
          status: productSeed.status,
          deletedAt: null,
          updatedAt: new Date(),
        };
        const [seededProduct] = existingProduct
          ? await transaction
              .update(products)
              .set(productValues)
              .where(sql`${products.id} = ${existingProduct.id}`)
              .returning({ id: products.id })
          : await transaction
              .insert(products)
              .values(productValues)
              .returning({ id: products.id });

        if (!seededProduct) {
          throw new Error(`Could not persist seed product ${productSeed.sku}`);
        }

        const [existingImage] = await transaction
          .select({ id: productImages.id })
          .from(productImages)
          .where(sql`${productImages.productId} = ${seededProduct.id}`)
          .limit(1);

        if (existingImage) {
          await transaction
            .update(productImages)
            .set({
              storageKey: productSeed.imageStorageKey,
              url: productSeed.imageUrl,
              updatedAt: new Date(),
            })
            .where(sql`${productImages.id} = ${existingImage.id}`);
        } else {
          await transaction.insert(productImages).values({
            productId: seededProduct.id,
            storageKey: productSeed.imageStorageKey,
            url: productSeed.imageUrl,
          });
        }

        const [existingBalance] = await transaction
          .select({ availableQuantity: inventoryBalances.availableQuantity })
          .from(inventoryBalances)
          .where(sql`${inventoryBalances.productId} = ${seededProduct.id}`)
          .limit(1);

        if (!existingBalance) {
          await transaction.insert(inventoryBalances).values({
            productId: seededProduct.id,
            availableQuantity: productSeed.availableQuantity,
          });
          await transaction.insert(inventoryMovements).values({
            productId: seededProduct.id,
            type: "OPENING",
            quantityDelta: productSeed.availableQuantity,
            balanceAfter: productSeed.availableQuantity,
            reason: "Development catalog opening inventory",
            referenceType: "DEVELOPMENT_SEED",
            referenceId: productSeed.sku,
            actorUserId: adminUserId,
          });
        } else if (
          existingBalance.availableQuantity !== productSeed.availableQuantity
        ) {
          const quantityDelta =
            productSeed.availableQuantity - existingBalance.availableQuantity;

          await transaction
            .update(inventoryBalances)
            .set({
              availableQuantity: productSeed.availableQuantity,
              version: sql`${inventoryBalances.version} + 1`,
              updatedAt: new Date(),
            })
            .where(sql`${inventoryBalances.productId} = ${seededProduct.id}`);
          await transaction.insert(inventoryMovements).values({
            productId: seededProduct.id,
            type: "ADJUSTMENT",
            quantityDelta,
            balanceAfter: productSeed.availableQuantity,
            reason: "Development catalog seed synchronization",
            referenceType: "DEVELOPMENT_SEED",
            referenceId: productSeed.sku,
            actorUserId: adminUserId,
          });
        }
      }

      return {
        users: seededUserIds.size,
        roleAssignments: seededUserIds.size,
        products: DEVELOPMENT_PRODUCTS.length,
        productImages: DEVELOPMENT_PRODUCTS.length,
        inventoryBalances: DEVELOPMENT_PRODUCTS.length,
        inventoryMovements: DEVELOPMENT_PRODUCTS.length,
      };
    });
  } finally {
    await pool.end();
  }
}
