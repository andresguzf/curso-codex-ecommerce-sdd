import { Inject, Injectable } from "@nestjs/common";
import { deliveredCatalogImage } from "./image-storage/bundled-catalog-image";
import { and, asc, count, desc, eq, gt, ilike, isNull, isNotNull, lte, ne, or, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { inventoryBalances, productImages, products, wishlistItems, wishlists } from "../database/schema";

export class WishlistProductUnavailableError extends Error {}

export type WishlistListQuery = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  availability?: "AVAILABLE" | "UNAVAILABLE";
  sortBy: "createdAt" | "name" | "price";
  sortOrder: "asc" | "desc";
}>;

const stockAvailable = sql<number>`coalesce(${inventoryBalances.availableQuantity}, 0)`.mapWith(Number);
const availableProduct = and(
  eq(products.status, "ACTIVE"),
  isNull(products.deletedAt),
  gt(stockAvailable, 0),
);

function escapeLikePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export type WishlistItemRecord = Readonly<{
  id: string;
  productId: string;
  createdAt: Date;
  productStatus: "ACTIVE" | "INACTIVE";
  productDeletedAt: Date | null;
  product: Readonly<{
    id: string;
    name: string;
    slug: string | null;
    price: string;
    currency: "USD";
    image: Readonly<{ storageKey: string; url: string }> | null;
    stockAvailable: number;
    isAvailable: boolean;
  }>;
}>;

export type WishlistPage = Readonly<{
  items: WishlistItemRecord[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

@Injectable()
export class WishlistRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly database: Pick<DatabaseService, "client">,
  ) {}

  async listForCustomer(customerId: string, query: WishlistListQuery): Promise<WishlistPage> {
    return this.database.client.transaction(async (transaction) => {
      const conditions = [eq(wishlists.customerId, customerId)];
      if (query.search) {
        const pattern = escapeLikePattern(query.search);
        conditions.push(or(ilike(products.name, pattern), ilike(products.sku, pattern))!);
      }
      if (query.availability === "AVAILABLE") conditions.push(availableProduct!);
      if (query.availability === "UNAVAILABLE") {
        conditions.push(or(ne(products.status, "ACTIVE"), isNotNull(products.deletedAt), lte(stockAvailable, 0))!);
      }
      const where = and(...conditions);
      const sortColumn = {
        createdAt: wishlistItems.createdAt,
        name: products.name,
        price: products.price,
      }[query.sortBy];
      const direction = query.sortOrder === "asc" ? asc : desc;
      const [{ totalItems = 0 } = {}] = await transaction
        .select({ totalItems: count() })
        .from(wishlistItems)
        .innerJoin(wishlists, eq(wishlistItems.wishlistId, wishlists.id))
        .innerJoin(products, eq(wishlistItems.productId, products.id))
        .leftJoin(inventoryBalances, eq(inventoryBalances.productId, products.id))
        .where(where);
      const rows = await transaction
        .select({
          id: wishlistItems.id,
          productId: wishlistItems.productId,
          createdAt: wishlistItems.createdAt,
          productStatus: products.status,
          productDeletedAt: products.deletedAt,
          name: products.name,
          slug: products.slug,
          price: products.price,
          currency: products.currency,
          imageStorageKey: productImages.storageKey,
          imageUrl: productImages.url,
          stockAvailable: inventoryBalances.availableQuantity,
        })
        .from(wishlistItems)
        .innerJoin(wishlists, eq(wishlistItems.wishlistId, wishlists.id))
        .innerJoin(products, eq(wishlistItems.productId, products.id))
        .leftJoin(productImages, and(eq(productImages.productId, products.id), eq(productImages.isPrimary, true)))
        .leftJoin(inventoryBalances, eq(inventoryBalances.productId, products.id))
        .where(where)
        .orderBy(direction(sortColumn), direction(wishlistItems.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);

      const items = rows.map((row) => ({
        id: row.id,
        productId: row.productId,
        createdAt: row.createdAt,
        productStatus: row.productStatus,
        productDeletedAt: row.productDeletedAt,
        product: {
          id: row.productId,
          name: row.name,
          slug: row.slug,
          price: row.price,
          currency: "USD" as const,
          image: row.imageStorageKey && row.imageUrl
            ? deliveredCatalogImage({ storageKey: row.imageStorageKey, url: row.imageUrl })
            : null,
          stockAvailable: row.stockAvailable ?? 0,
          isAvailable: row.productStatus === "ACTIVE" && row.productDeletedAt === null && (row.stockAvailable ?? 0) > 0,
        },
      }));

      return {
        items,
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      };
    }, { isolationLevel: "repeatable read" });
  }

  async addItem(customerId: string, productId: string): Promise<boolean> {
    return this.database.client.transaction(async (transaction) => {
      const [product] = await transaction.select({ status: products.status, deletedAt: products.deletedAt })
        .from(products).where(eq(products.id, productId)).for("share").limit(1);
      if (!product || product.status !== "ACTIVE" || product.deletedAt !== null) {
        throw new WishlistProductUnavailableError("Product is not available for wishlist");
      }
      const [createdWishlist] = await transaction
        .insert(wishlists)
        .values({ customerId })
        .onConflictDoNothing({ target: wishlists.customerId })
        .returning({ id: wishlists.id });
      const [existingWishlist] = createdWishlist ? [createdWishlist] : await transaction
        .select({ id: wishlists.id })
        .from(wishlists)
        .where(eq(wishlists.customerId, customerId))
        .limit(1);
      const wishlist = existingWishlist;
      if (!wishlist) throw new Error("PostgreSQL did not return the customer's wishlist");

      const [createdItem] = await transaction
        .insert(wishlistItems)
        .values({ wishlistId: wishlist.id, productId })
        .onConflictDoNothing({ target: [wishlistItems.wishlistId, wishlistItems.productId] })
        .returning({ id: wishlistItems.id });
      if (createdItem) {
        await transaction.update(wishlists)
          .set({ updatedAt: new Date() })
          .where(eq(wishlists.id, wishlist.id));
      }
      return Boolean(createdItem);
    });
  }

  async removeItem(customerId: string, productId: string): Promise<boolean> {
    return this.database.client.transaction(async (transaction) => {
      const [wishlist] = await transaction
        .select({ id: wishlists.id })
        .from(wishlists)
        .where(eq(wishlists.customerId, customerId))
        .limit(1);
      if (!wishlist) return false;

      const [deletedItem] = await transaction
        .delete(wishlistItems)
        .where(and(eq(wishlistItems.wishlistId, wishlist.id), eq(wishlistItems.productId, productId)))
        .returning({ id: wishlistItems.id });
      if (deletedItem) {
        await transaction.update(wishlists)
          .set({ updatedAt: new Date() })
          .where(eq(wishlists.id, wishlist.id));
      }
      return Boolean(deletedItem);
    });
  }
}
