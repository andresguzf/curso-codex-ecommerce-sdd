import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { createAuditEntry } from "../audit-observability/audit-entry";
import { DatabaseService } from "../database/database.service";
import type { DatabaseTransaction } from "../database/database.service";
import {
  auditEntries,
  categories,
  inventoryBalances,
  productImages,
  productTags,
  products,
  tags,
} from "../database/schema";
import type {
  AdministrativeProduct,
  CreateAdministrativeProduct,
  ProductListItem,
  ProductListQuery,
  ProductPage,
  ProductDetail,
  ProductStatus,
  ProductClassificationSummary,
  UpdateAdministrativeProduct,
} from "./product-administration.types";
import { SYSTEM_CURRENCY } from "../shared/system-currency";
import { normalizeSlug, slugCandidate } from "./slug";

const productSelection = {
  id: products.id,
  categoryId: products.categoryId,
  sku: products.sku,
  slug: products.slug,
  name: products.name,
  description: products.description,
  price: products.price,
  currency: products.currency,
  status: products.status,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
  deletedAt: products.deletedAt,
  imageStorageKey: productImages.storageKey,
  imageUrl: productImages.url,
};

const stockAvailableExpression = sql<number>`coalesce(${inventoryBalances.availableQuantity}, 0)`.mapWith(Number);
const productListSelection = {
  ...productSelection,
  stockAvailable: stockAvailableExpression,
};

type ProductSelectionRow = Readonly<{
  id: string;
  categoryId: string | null;
  sku: string;
  slug: string | null;
  name: string;
  description: string;
  price: string;
  currency: string;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  imageStorageKey: string;
  imageUrl: string;
}>;

export class ProductCategoryRequiredError extends Error {}
export class ProductClassificationUnavailableError extends Error {}
export class ProductTagLimitExceededError extends Error {}
export class ProductTagNameInvalidError extends Error {}
export class ProductTagInactiveError extends Error {}

type Classifications = Readonly<{
  category: ProductClassificationSummary | null;
  tags: ProductClassificationSummary[];
}>;

@Injectable()
export class ProductAdministrationRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(query: ProductListQuery): Promise<ProductPage> {
    const conditions = [isNull(products.deletedAt)];

    if (query.search) {
      const pattern = `%${this.escapeLikePattern(query.search)}%`;
      conditions.push(
        or(
          sql`${products.name} ilike ${pattern} escape '\\'`,
          sql`${products.description} ilike ${pattern} escape '\\'`,
          sql`${products.sku} ilike ${pattern} escape '\\'`,
        )!,
      );
    }
    if (query.status) conditions.push(eq(products.status, query.status));
    if (query.categoryId) {
      conditions.push(eq(products.categoryId, query.categoryId));
      if (query.view === "public") conditions.push(sql`exists (select 1 from categories c where c.id = ${products.categoryId} and c.status = 'ACTIVE' and c.deleted_at is null)`);
    }
    if (query.tagIds?.length) {
      conditions.push(sql`exists (select 1 from product_tags pt inner join tags t on t.id = pt.tag_id where pt.product_id = ${products.id} and ${inArray(sql`pt.tag_id`, query.tagIds)} ${query.view === "public" ? sql`and t.status = 'ACTIVE' and t.deleted_at is null` : sql``})`);
    }
    if (query.minPrice) conditions.push(gte(products.price, query.minPrice));
    if (query.maxPrice) conditions.push(lte(products.price, query.maxPrice));
    if (query.createdFrom) {
      conditions.push(gte(products.createdAt, new Date(`${query.createdFrom}T00:00:00.000Z`)));
    }
    if (query.createdTo) {
      const endExclusive = new Date(Date.parse(`${query.createdTo}T00:00:00.000Z`) + 86_400_000);
      conditions.push(lt(products.createdAt, endExclusive));
    }
    if (query.availability === "IN_STOCK") {
      conditions.push(sql`${stockAvailableExpression} > 0`);
    }
    if (query.availability === "OUT_OF_STOCK") {
      conditions.push(sql`${stockAvailableExpression} = 0`);
    }

    const where = and(...conditions);
    const sortColumn = {
      createdAt: products.createdAt,
      name: products.name,
      price: products.price,
      sku: products.sku,
      stockAvailable: stockAvailableExpression,
      updatedAt: products.updatedAt,
    }[query.sortBy];
    const order = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
    const [{ totalItems = 0 } = {}] = await this.database.client
      .select({ totalItems: count() })
      .from(products)
      .innerJoin(productImages, eq(productImages.productId, products.id))
      .leftJoin(
        inventoryBalances,
        eq(inventoryBalances.productId, products.id),
      )
      .where(where);
    const rows = await this.database.client
      .select(productListSelection)
      .from(products)
      .innerJoin(productImages, eq(productImages.productId, products.id))
      .leftJoin(
        inventoryBalances,
        eq(inventoryBalances.productId, products.id),
      )
      .where(where)
      .orderBy(order, asc(products.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    const classifications = await this.loadClassifications(rows.map((row) => row.id));
    return {
      items: rows.map((row) => this.toListItem(row, classifications.get(row.id))),
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    };
  }

  async findById(productId: string): Promise<AdministrativeProduct | undefined> {
    const [row] = await this.database.client
      .select(productSelection)
      .from(products)
      .innerJoin(productImages, eq(productImages.productId, products.id))
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);

    if (!row) return undefined;
    const classifications = await this.loadClassifications([row.id]);
    return this.toProduct(row, classifications.get(row.id));
  }

  async findDetailById(
    productId: string,
    includeInactive: boolean,
  ): Promise<ProductDetail | undefined> {
    const conditions = [
      eq(products.id, productId),
      isNull(products.deletedAt),
    ];
    if (!includeInactive) conditions.push(eq(products.status, "ACTIVE"));

    const [row] = await this.database.client
      .select(productListSelection)
      .from(products)
      .innerJoin(productImages, eq(productImages.productId, products.id))
      .leftJoin(
        inventoryBalances,
        eq(inventoryBalances.productId, products.id),
      )
      .where(and(...conditions))
      .limit(1);

    if (!row) return undefined;
    const classifications = await this.loadClassifications([row.id]);
    const product = this.toListItem(row, classifications.get(row.id));
    return {
      ...product,
      availability:
        product.stockAvailable > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    };
  }

  async findPublicDetailBySlug(slug: string): Promise<ProductDetail | undefined> {
    const [row] = await this.database.client
      .select(productListSelection)
      .from(products)
      .innerJoin(productImages, eq(productImages.productId, products.id))
      .leftJoin(inventoryBalances, eq(inventoryBalances.productId, products.id))
      .where(and(eq(products.slug, slug), eq(products.status, "ACTIVE"), isNull(products.deletedAt)))
      .limit(1);
    if (!row) return undefined;
    const classifications = await this.loadClassifications([row.id]);
    const product = this.toListItem(row, classifications.get(row.id));
    return { ...product, availability: product.stockAvailable > 0 ? "IN_STOCK" : "OUT_OF_STOCK" };
  }

  async create(
    input: CreateAdministrativeProduct,
    actorUserId: string,
  ): Promise<AdministrativeProduct> {
    const baseSlug = normalizeSlug(input.slug ?? input.name);
    for (let attempt = 1; attempt <= 1000; attempt += 1) {
      try {
        return await this.createWithSlug(
          input,
          slugCandidate(baseSlug, attempt),
          actorUserId,
        );
      } catch (error) {
        if (input.slug || !this.isSlugCollision(error) || attempt === 1000) throw error;
      }
    }
    throw new Error("Could not allocate product slug");
  }

  private createWithSlug(
    input: CreateAdministrativeProduct,
    slug: string,
    actorUserId: string,
  ): Promise<AdministrativeProduct> {
    return this.database.client.transaction(async (transaction) => {
      const tagIds = await this.resolveTagIds(transaction, input.tagIds ?? [], input.tagNames ?? [], actorUserId);
      await this.validateAssignments(transaction, input.categoryId ?? null, tagIds, input.status === "ACTIVE");
      const [product] = await transaction
        .insert(products)
        .values({
          currency: SYSTEM_CURRENCY,
          categoryId: input.categoryId ?? null,
          description: input.description,
          name: input.name,
          price: input.price,
          sku: input.sku,
          slug,
          status: input.status,
        })
        .returning();

      if (!product) throw new Error("PostgreSQL did not return the created product");

      await transaction.insert(productImages).values({
        productId: product.id,
        storageKey: input.image.storageKey,
        url: input.image.url,
      });
      if (tagIds.length) await transaction.insert(productTags).values(tagIds.map((tagId, sortOrder) => ({ productId: product.id, tagId, sortOrder })));

      const classifications = await this.loadClassifications([product.id], transaction);

      const created: AdministrativeProduct = {
        ...product,
        currency: SYSTEM_CURRENCY,
        image: input.image,
        category: classifications.get(product.id)?.category ?? null,
        tags: classifications.get(product.id)?.tags ?? [],
      };
      await transaction.insert(auditEntries).values(
        createAuditEntry({
          action: "PRODUCT_CREATED",
          actorUserId,
          changes: { after: this.auditSnapshot(created) },
          entityId: product.id,
          entityType: "PRODUCT",
        }),
      );

      return created;
    });
  }

  async update(
    productId: string,
    input: UpdateAdministrativeProduct,
    actorUserId: string,
  ): Promise<AdministrativeProduct | undefined> {
    return this.database.client.transaction(async (transaction) => {
      const [currentRow] = await transaction
        .select(productSelection)
        .from(products)
        .innerJoin(productImages, eq(productImages.productId, products.id))
        .where(and(eq(products.id, productId), isNull(products.deletedAt)))
        .limit(1);

      if (!currentRow) return undefined;
      const before = await this.loadClassifications([productId], transaction);
      const current = this.toProduct(currentRow, before.get(productId));
      const replacingTags = input.tagIds !== undefined || input.tagNames !== undefined;
      const tagIds = replacingTags
        ? await this.resolveTagIds(transaction, input.tagIds ?? [], input.tagNames ?? [], actorUserId)
        : [];
      if (input.categoryId !== undefined || replacingTags) {
        await this.validateAssignments(transaction, input.categoryId === undefined ? null : input.categoryId, tagIds, currentRow.status === "ACTIVE" && input.categoryId !== undefined);
      }
      const now = new Date();
      const [updated] = await transaction
        .update(products)
        .set({
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.price === undefined ? {} : { price: input.price }),
          ...(input.sku === undefined ? {} : { sku: input.sku }),
          ...(input.slug === undefined ? {} : { slug: input.slug }),
          ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
          updatedAt: now,
        })
        .where(eq(products.id, productId))
        .returning();

      if (!updated) throw new Error("PostgreSQL did not return the updated product");

      let image = current.image;
      if (input.image) {
        const [updatedImage] = await transaction
          .update(productImages)
          .set({
            storageKey: input.image.storageKey,
            updatedAt: now,
            url: input.image.url,
          })
          .where(eq(productImages.productId, productId))
          .returning({
            storageKey: productImages.storageKey,
            url: productImages.url,
          });
        if (!updatedImage) throw new Error("PostgreSQL did not return the updated image");
        image = updatedImage;
      }

      if (replacingTags) {
        await transaction.delete(productTags).where(eq(productTags.productId, productId));
        if (tagIds.length) await transaction.insert(productTags).values(tagIds.map((tagId, sortOrder) => ({ productId, tagId, sortOrder })));
      }
      const classifications = await this.loadClassifications([productId], transaction);

      const result: AdministrativeProduct = {
        ...updated,
        currency: SYSTEM_CURRENCY,
        image,
        category: classifications.get(productId)?.category ?? null,
        tags: classifications.get(productId)?.tags ?? [],
      };
      await transaction.insert(auditEntries).values(
        createAuditEntry({
          action: "PRODUCT_UPDATED",
          actorUserId,
          changes: {
            after: this.auditSnapshot(result),
            before: this.auditSnapshot(current),
          },
          entityId: productId,
          entityType: "PRODUCT",
        }),
      );
      return result;
    });
  }

  async updateStatus(
    productId: string,
    status: ProductStatus,
    actorUserId: string,
  ): Promise<AdministrativeProduct | undefined> {
    return this.database.client.transaction(async (transaction) => {
      const [currentRow] = await transaction
        .select(productSelection)
        .from(products)
        .innerJoin(productImages, eq(productImages.productId, products.id))
        .where(and(eq(products.id, productId), isNull(products.deletedAt)))
        .limit(1);
      if (!currentRow) return undefined;

      const before = await this.loadClassifications([productId], transaction);
      const current = this.toProduct(currentRow, before.get(productId));
      if (status === "ACTIVE" && currentRow.status !== "ACTIVE") {
        await this.validateAssignments(transaction, currentRow.categoryId, [], true);
      }
      const [updated] = await transaction
        .update(products)
        .set({ status, updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning();
      if (!updated) throw new Error("PostgreSQL did not return the updated product status");

      const result: AdministrativeProduct = {
        ...updated,
        currency: SYSTEM_CURRENCY,
        image: current.image,
        category: current.category,
        tags: current.tags,
      };
      await transaction.insert(auditEntries).values(
        createAuditEntry({
          action:
            status === "ACTIVE"
              ? "PRODUCT_ACTIVATED"
              : "PRODUCT_DEACTIVATED",
          actorUserId,
          changes: {
            after: this.auditSnapshot(result),
            before: this.auditSnapshot(current),
          },
          entityId: productId,
          entityType: "PRODUCT",
        }),
      );
      return result;
    });
  }

  async softDelete(productId: string, actorUserId: string): Promise<boolean> {
    return this.database.client.transaction(async (transaction) => {
      const [currentRow] = await transaction
        .select(productSelection)
        .from(products)
        .innerJoin(productImages, eq(productImages.productId, products.id))
        .where(and(eq(products.id, productId), isNull(products.deletedAt)))
        .limit(1);
      if (!currentRow) return false;

      const before = await this.loadClassifications([productId], transaction);
      const current = this.toProduct(currentRow, before.get(productId));
      const now = new Date();
      await transaction
        .update(products)
        .set({ deletedAt: now, status: "INACTIVE", updatedAt: now })
        .where(eq(products.id, productId));
      await transaction.insert(auditEntries).values(
        createAuditEntry({
          action: "PRODUCT_DELETED",
          actorUserId,
          changes: {
            after: {
              ...this.auditSnapshot(current),
              deletedAt: now.toISOString(),
              status: "INACTIVE",
            },
            before: this.auditSnapshot(current),
          },
          entityId: productId,
          entityType: "PRODUCT",
        }),
      );
      return true;
    });
  }

  private async resolveTagIds(
    transaction: DatabaseTransaction,
    selectedIds: readonly string[],
    names: readonly string[],
    actorUserId: string,
  ): Promise<string[]> {
    const resolved = new Set(selectedIds);
    const seenNames = new Set<string>();

    for (const rawName of names) {
      const name = rawName.trim();
      const nameKey = name.toUpperCase();
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);

      let baseSlug: string;
      try {
        baseSlug = normalizeSlug(name, 140);
      } catch {
        throw new ProductTagNameInvalidError();
      }

      const findByName = async () => {
        const [record] = await transaction.select({ id: tags.id, status: tags.status, deletedAt: tags.deletedAt })
          .from(tags)
          .where(sql`upper(${tags.name}) = upper(${name})`)
          .limit(1);
        return record;
      };
      let record = await findByName();
      if (!record) {
        for (let attempt = 1; attempt <= 1000; attempt += 1) {
          const slug = slugCandidate(baseSlug, attempt, 140);
          const [created] = await transaction.insert(tags).values({ name, slug, status: "ACTIVE" })
            .onConflictDoNothing()
            .returning({ id: tags.id });
          if (created) {
            await transaction.insert(auditEntries).values(createAuditEntry({
              action: "TAG_CREATED",
              actorUserId,
              changes: { after: { id: created.id, name, slug, status: "ACTIVE" } },
              entityId: created.id,
              entityType: "TAG",
            }));
            resolved.add(created.id);
            break;
          }
          record = await findByName();
          if (record) break;
          if (attempt === 1000) throw new ProductTagNameInvalidError();
        }
      }
      if (record) {
        if (record.status !== "ACTIVE" || record.deletedAt) throw new ProductTagInactiveError();
        resolved.add(record.id);
      }
    }

    if (resolved.size > 20) throw new ProductTagLimitExceededError();
    return [...resolved];
  }

  private async validateAssignments(
    transaction: DatabaseTransaction,
    categoryId: string | null,
    tagIds: readonly string[],
    categoryRequired: boolean,
  ): Promise<void> {
    if (categoryRequired && !categoryId) throw new ProductCategoryRequiredError();
    if (categoryId) {
      const [category] = await transaction.select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, categoryId), eq(categories.status, "ACTIVE"), isNull(categories.deletedAt)))
        .for("share")
        .limit(1);
      if (!category) throw new ProductClassificationUnavailableError();
    }
    if (tagIds.length) {
      const found = await transaction.select({ id: tags.id })
        .from(tags)
        .where(and(inArray(tags.id, [...tagIds]), eq(tags.status, "ACTIVE"), isNull(tags.deletedAt)))
        .for("share");
      if (found.length !== tagIds.length) throw new ProductClassificationUnavailableError();
    }
  }

  private async loadClassifications(
    productIds: string[],
    client: DatabaseTransaction | DatabaseService["client"] = this.database.client,
  ): Promise<Map<string, Classifications>> {
    const result = new Map<string, Classifications>();
    if (!productIds.length) return result;
    const categoryRows = await client.select({ productId: products.id, id: categories.id, name: categories.name, slug: categories.slug, status: categories.status })
      .from(products).leftJoin(categories, eq(products.categoryId, categories.id))
      .where(inArray(products.id, productIds));
    for (const row of categoryRows) {
      result.set(row.productId, { category: row.id && row.name && row.slug && row.status ? { id: row.id, name: row.name, slug: row.slug, status: row.status } : null, tags: [] });
    }
    const tagRows = await client.select({ productId: productTags.productId, id: tags.id, name: tags.name, slug: tags.slug, status: tags.status })
      .from(productTags).innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(inArray(productTags.productId, productIds))
      .orderBy(asc(productTags.sortOrder), asc(tags.id));
    for (const row of tagRows) result.get(row.productId)?.tags.push({ id: row.id, name: row.name, slug: row.slug, status: row.status });
    return result;
  }

  private toProduct(row: ProductSelectionRow, classifications?: Classifications): AdministrativeProduct {
    return {
      id: row.id,
      sku: row.sku,
      slug: row.slug,
      category: classifications?.category ?? null,
      tags: classifications?.tags ?? [],
      name: row.name,
      description: row.description,
      price: row.price,
      currency: SYSTEM_CURRENCY,
      image: { storageKey: row.imageStorageKey, url: row.imageUrl },
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  private toListItem(
    row: ProductSelectionRow & { stockAvailable: number },
    classifications?: Classifications,
  ): ProductListItem {
    const product = this.toProduct(row, classifications);
    return {
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      category: product.category,
      tags: product.tags,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      image: product.image,
      status: product.status,
      stockAvailable: row.stockAvailable,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private escapeLikePattern(value: string): string {
    return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
  }

  private auditSnapshot(product: AdministrativeProduct): Record<string, unknown> {
    return {
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      category: product.category,
      tags: product.tags,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      image: product.image,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      deletedAt: product.deletedAt?.toISOString() ?? null,
    };
  }

  private isSlugCollision(error: unknown): boolean {
    let current: unknown = error;
    for (let depth = 0; depth < 3 && current; depth += 1) {
      if (typeof current === "object" && "constraint" in current) {
        return current.constraint === "products_slug_unique";
      }
      current = typeof current === "object" && "cause" in current ? current.cause : undefined;
    }
    return false;
  }
}
