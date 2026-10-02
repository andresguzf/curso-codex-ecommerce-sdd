import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import { assertProductImageCapacity } from "../../product-catalog/product-image-limit";
import { getDevelopmentProductImageManifest } from "./product-image-manifest";

type Transaction = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];
const CLASSIFICATIONS = {
  laptop: { name: "DEMO - Notebooks", price: "1299.90", quantity: 12 },
  monitor: { name: "DEMO - Monitores", price: "499.90", quantity: 8 },
  keyboard: { name: "DEMO - Teclados", price: "149.90", quantity: 20 },
  phone: { name: "DEMO - Smartphones", price: "699.90", quantity: 15 },
} as const;
const LANDING_CATEGORIES = ["laptop", "monitor", "phone"] as const;
const FEATURED_SKUS = ["DEV-LAPTOP-001", "DEV-MONITOR-001", "DEV-PHONE-001"];
const EDITORIAL_EPOCH = Date.parse("2026-01-01T00:00:00.000Z");

/** Seed-owned SKU/key namespace only; never resets operational inventory. */
export async function seedCatalog(
  transaction: Transaction,
  environment: unknown,
  adminUserId: string,
) {
  const manifest = getDevelopmentProductImageManifest(environment);
  // Share the editorial lock with administrative mutations. Never evict a
  // non-demo category to make room for the reproducible demo composition.
  await transaction.execute(sql`select pg_advisory_xact_lock(84110420262102::bigint)`);
  const selected = await transaction.select().from(schema.categories)
    .where(eq(schema.categories.showOnLanding, true)).for("update");
  const demoSlugs = Object.keys(CLASSIFICATIONS).map((kind) => `dev-${kind}`);
  if (selected.some((category) => !demoSlugs.includes(category.slug))) {
    throw new Error("Demo editorial seed requires free landing slots; retire non-demo selections explicitly before retrying");
  }
  // Clear only seed-owned positions first, allowing a prior admin swap to be
  // restored without transient uniqueness violations inside this transaction.
  for (const category of selected) {
    await transaction.update(schema.categories).set({ showOnLanding: false, landingOrder: null })
      .where(eq(schema.categories.id, category.id));
  }
  const categoryIds = new Map<string, string>();
  for (const [kind, classification] of Object.entries(CLASSIFICATIONS)) {
    const position = LANDING_CATEGORIES.findIndex((entry) => entry === kind);
    const editorial = { showOnLanding: position >= 0, landingOrder: position >= 0 ? position + 1 : null };
    const [category] = await transaction.insert(schema.categories).values({
      name: classification.name, slug: `dev-${kind}`, status: "ACTIVE", ...editorial,
    }).onConflictDoUpdate({ target: schema.categories.slug, set: {
      name: classification.name, status: "ACTIVE", deletedAt: null, ...editorial,
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
  for (const [index, entry] of manifest.entries()) {
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
      // Distinct fixed demo dates avoid UUID tie-breaks changing the composition
      // between fresh databases. Only the seed-owned fichas are normalized.
      createdAt: new Date(EDITORIAL_EPOCH + index * 60_000),
      isFeatured: FEATURED_SKUS.includes(entry.sku),
      featuredAt: FEATURED_SKUS.includes(entry.sku)
        ? new Date(EDITORIAL_EPOCH + (FEATURED_SKUS.indexOf(entry.sku) + 1) * 86_400_000) : null,
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
    // The existing product is locked above (new products are private to this
    // transaction). Preserve custom/legacy images; never make room by deletion.
    const existingKeys = new Set(existingImages.map((image) => image.storageKey));
    const additions = new Set(entry.images.filter((image) => !existingKeys.has(image.storageKey)).map((image) => image.storageKey)).size;
    assertProductImageCapacity(existingImages.length, additions);
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
