import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import {
  auditEntries,
  inventoryBalances,
  productImages,
  products,
} from "../database/schema";
import type {
  AdministrativeProduct,
  CreateAdministrativeProduct,
  ProductListItem,
  ProductListQuery,
  ProductPage,
  ProductDetail,
  ProductStatus,
  UpdateAdministrativeProduct,
} from "./product-administration.types";

const productSelection = {
  id: products.id,
  sku: products.sku,
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
  sku: string;
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
    if (query.currency) conditions.push(eq(products.currency, query.currency));
    if (query.minPrice) conditions.push(gte(products.price, query.minPrice));
    if (query.maxPrice) conditions.push(lte(products.price, query.maxPrice));
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

    return {
      items: rows.map((row) => this.toListItem(row)),
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

    return row ? this.toProduct(row) : undefined;
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
    const product = this.toListItem(row);
    return {
      ...product,
      availability:
        product.stockAvailable > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    };
  }

  async create(
    input: CreateAdministrativeProduct,
    actorUserId: string,
  ): Promise<AdministrativeProduct> {
    return this.database.client.transaction(async (transaction) => {
      const [product] = await transaction
        .insert(products)
        .values({
          currency: input.currency,
          description: input.description,
          name: input.name,
          price: input.price,
          sku: input.sku,
          status: input.status,
        })
        .returning();

      if (!product) throw new Error("PostgreSQL did not return the created product");

      await transaction.insert(productImages).values({
        productId: product.id,
        storageKey: input.image.storageKey,
        url: input.image.url,
      });

      const created = { ...product, image: input.image };
      await transaction.insert(auditEntries).values({
        action: "PRODUCT_CREATED",
        actorUserId,
        changes: { after: this.auditSnapshot(created) },
        entityId: product.id,
        entityType: "PRODUCT",
      });

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
      const current = this.toProduct(currentRow);
      const now = new Date();
      const [updated] = await transaction
        .update(products)
        .set({
          ...(input.currency === undefined ? {} : { currency: input.currency }),
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.price === undefined ? {} : { price: input.price }),
          ...(input.sku === undefined ? {} : { sku: input.sku }),
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

      const result = { ...updated, image };
      await transaction.insert(auditEntries).values({
        action: "PRODUCT_UPDATED",
        actorUserId,
        changes: {
          after: this.auditSnapshot(result),
          before: this.auditSnapshot(current),
        },
        entityId: productId,
        entityType: "PRODUCT",
      });
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

      const current = this.toProduct(currentRow);
      const [updated] = await transaction
        .update(products)
        .set({ status, updatedAt: new Date() })
        .where(eq(products.id, productId))
        .returning();
      if (!updated) throw new Error("PostgreSQL did not return the updated product status");

      const result = { ...updated, image: current.image };
      await transaction.insert(auditEntries).values({
        action: status === "ACTIVE" ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
        actorUserId,
        changes: {
          after: this.auditSnapshot(result),
          before: this.auditSnapshot(current),
        },
        entityId: productId,
        entityType: "PRODUCT",
      });
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

      const current = this.toProduct(currentRow);
      const now = new Date();
      await transaction
        .update(products)
        .set({ deletedAt: now, status: "INACTIVE", updatedAt: now })
        .where(eq(products.id, productId));
      await transaction.insert(auditEntries).values({
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
      });
      return true;
    });
  }

  private toProduct(row: ProductSelectionRow): AdministrativeProduct {
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      description: row.description,
      price: row.price,
      currency: row.currency,
      image: { storageKey: row.imageStorageKey, url: row.imageUrl },
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  private toListItem(
    row: ProductSelectionRow & { stockAvailable: number },
  ): ProductListItem {
    const product = this.toProduct(row);
    return {
      id: product.id,
      sku: product.sku,
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
}
