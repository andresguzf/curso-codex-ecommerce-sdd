import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import { getDevelopmentProductImageManifest } from "./product-image-manifest";

type Transaction = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];
const CLASSIFICATIONS = {
  laptop: { name: "DEMO - Notebooks", price: "1299.90", quantity: 12 },
  monitor: { name: "DEMO - Monitores", price: "499.90", quantity: 8 },
  keyboard: { name: "DEMO - Teclados", price: "149.90", quantity: 20 },
  phone: { name: "DEMO - Smartphones", price: "699.90", quantity: 15 },
} as const;

/** Seed-owned SKU/key namespace only; never resets operational inventory. */
export async function seedCatalog(
  transaction: Transaction,
  environment: unknown,
  adminUserId: string,
) {
  const manifest = getDevelopmentProductImageManifest(environment);
  const categoryIds = new Map<string, string>();
  for (const [kind, classification] of Object.entries(CLASSIFICATIONS)) {
    const [category] = await transaction.insert(schema.categories).values({
      name: classification.name, slug: `dev-${kind}`, status: "ACTIVE",
    }).onConflictDoUpdate({ target: schema.categories.slug, set: {
      name: classification.name, status: "ACTIVE", deletedAt: null,
    } }).returning({ id: schema.categories.id });
    if (!category) throw new Error("Could not persist demo category");
    categoryIds.set(kind, category.id);
  }
  const tagIds: string[] = [];
  for (const [slug, name] of [["dev-demo", "DEMO"], ["dev-technology", "DEMO - Tecnología"]]) {
    const [tag] = await transaction.insert(schema.tags).values({ slug, name }).onConflictDoUpdate({
      target: schema.tags.slug, set: { name, status: "ACTIVE", deletedAt: null },
    }).returning({ id: schema.tags.id });
    if (!tag) throw new Error("Could not persist demo tag");
    tagIds.push(tag.id);
  }

  let openingMovementsCreated = 0;
  for (const entry of manifest) {
    const classification = CLASSIFICATIONS[entry.kind];
    const [existing] = await transaction.select().from(schema.products)
      .where(sql`upper(${schema.products.sku}) = ${entry.sku}`).for("update");
    const values = {
      sku: entry.sku, name: entry.name,
      description: `Producto tecnológico de demostración: ${entry.name}. Imágenes ilustrativas temporales.`,
      price: classification.price, currency: "USD", categoryId: categoryIds.get(entry.kind),
      slug: existing?.slug ?? entry.sku.toLowerCase(),
      status: entry.sku === "DEV-KEYBOARD-001" || entry.sku === "DEV-PHONE-006"
        ? "INACTIVE" as const : "ACTIVE" as const,
      deletedAt: null, updatedAt: new Date(),
    };
    const [product] = existing
      ? await transaction.update(schema.products).set(values).where(eq(schema.products.id, existing.id)).returning()
      : await transaction.insert(schema.products).values(values).returning();
    if (!product) throw new Error("Could not persist demo product");

    for (const [sortOrder, tagId] of tagIds.entries()) {
      await transaction.insert(schema.productTags).values({ productId: product.id, tagId, sortOrder })
        .onConflictDoNothing();
    }

    // Move existing images out of final positions before assigning the ordered manifest.
    // Keep any additional images uploaded by administrators; never delete their assets.
    const existingImages = await transaction.select().from(schema.productImages)
      .where(eq(schema.productImages.productId, product.id)).orderBy(schema.productImages.sortOrder);
    const offset = Math.max(0, ...existingImages.map((image) => image.sortOrder)) + 61;
    await transaction.update(schema.productImages).set({ isPrimary: false })
      .where(eq(schema.productImages.productId, product.id));
    for (const [index, image] of existingImages.entries()) {
      await transaction.update(schema.productImages).set({ sortOrder: offset + index })
        .where(eq(schema.productImages.id, image.id));
    }
    for (const image of entry.images) {
      const [ownedImage] = await transaction.select().from(schema.productImages)
        .where(eq(schema.productImages.storageKey, image.storageKey));
      if (ownedImage && ownedImage.productId !== product.id) {
        throw new Error("Demo image key belongs to another product");
      }
      const imageValues = {
        productId: product.id, storageKey: image.storageKey, url: image.url,
        altText: image.altText, isPrimary: image.isPrimary, sortOrder: image.sortOrder,
        width: image.width, height: image.height, mimeType: image.mimeType, updatedAt: new Date(),
      };
      if (ownedImage) {
        await transaction.update(schema.productImages).set(imageValues)
          .where(eq(schema.productImages.id, ownedImage.id));
      } else {
        await transaction.insert(schema.productImages).values(imageValues);
      }
    }
    const additionalImages = existingImages.filter((image) => !entry.images.some((seed) => seed.storageKey === image.storageKey));
    for (const [index, image] of additionalImages.entries()) {
      await transaction.update(schema.productImages).set({ sortOrder: entry.images.length + index })
        .where(eq(schema.productImages.id, image.id));
    }

    const [balance] = await transaction.select().from(schema.inventoryBalances)
      .where(eq(schema.inventoryBalances.productId, product.id)).for("update");
    if (!balance) {
      await transaction.insert(schema.inventoryBalances).values({
        productId: product.id, availableQuantity: classification.quantity,
      });
      await transaction.insert(schema.inventoryMovements).values({
        productId: product.id, type: "OPENING", quantityDelta: classification.quantity,
        balanceAfter: classification.quantity, reason: "Development catalog opening inventory",
        referenceType: "DEVELOPMENT_SEED", referenceId: entry.sku, actorUserId: adminUserId,
      });
      openingMovementsCreated += 1;
    }
  }
  return {
    categories: categoryIds.size, tags: tagIds.length, productTags: manifest.length * tagIds.length,
    products: manifest.length, productImages: manifest.reduce((total, entry) => total + entry.images.length, 0),
    inventoryBalances: manifest.length, inventoryMovements: openingMovementsCreated,
  };
}
