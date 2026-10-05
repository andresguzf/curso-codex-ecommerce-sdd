import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, gt, ilike, isNull, lte, or, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { inventoryBalances, products } from "../database/schema/index.js";
import type { InventoryBalancePage, InventoryBalanceQuery } from "./inventory-balance.types.js";

const availableQuantity = sql<number>`coalesce(${inventoryBalances.availableQuantity}, 0)`.mapWith(Number);

function escapeLikePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

@Injectable()
export class InventoryBalanceRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(query: InventoryBalanceQuery): Promise<InventoryBalancePage> {
    const conditions = [isNull(products.deletedAt)];
    if (query.search) {
      const pattern = escapeLikePattern(query.search);
      conditions.push(or(ilike(products.name, pattern), ilike(products.sku, pattern))!);
    }
    if (query.status) conditions.push(eq(products.status, query.status));
    if (query.availability === "IN_STOCK") conditions.push(gt(availableQuantity, 0));
    if (query.availability === "OUT_OF_STOCK") conditions.push(lte(availableQuantity, 0));
    const where = and(...conditions);
    const sortColumn = {
      name: products.name,
      sku: products.sku,
      status: products.status,
      availableQuantity,
      updatedAt: sql<Date>`coalesce(${inventoryBalances.updatedAt}, ${products.updatedAt})`,
    }[query.sortBy];
    const direction = query.sortOrder === "asc" ? asc : desc;

    return this.database.client.transaction(async (transaction) => {
      const [{ totalItems = 0 } = {}] = await transaction
        .select({ totalItems: count() })
        .from(products)
        .leftJoin(inventoryBalances, eq(inventoryBalances.productId, products.id))
        .where(where);

      const rows = await transaction
        .select({
          availableQuantity: inventoryBalances.availableQuantity,
          balanceUpdatedAt: inventoryBalances.updatedAt,
          name: products.name,
          productId: products.id,
          productUpdatedAt: products.updatedAt,
          sku: products.sku,
          status: products.status,
          version: inventoryBalances.version,
        })
        .from(products)
        .leftJoin(inventoryBalances, eq(inventoryBalances.productId, products.id))
        .where(where)
        .orderBy(direction(sortColumn), direction(products.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);

      return {
        items: rows.map((row) => ({
          availableQuantity: row.availableQuantity ?? 0,
          name: row.name,
          productId: row.productId,
          sku: row.sku,
          status: row.status,
          updatedAt: row.balanceUpdatedAt ?? row.productUpdatedAt,
          version: row.version ?? 0,
        })),
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }
}
