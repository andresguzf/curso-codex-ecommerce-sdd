import { Injectable } from "@nestjs/common";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database/database.service.js";
import { inventoryBalances, products } from "../database/schema/index.js";

@Injectable()
export class InventorySummaryReader {
  async countLowStockProducts(transaction: DatabaseTransaction, threshold: number): Promise<number> {
    const [result] = await transaction.select({ total: count() }).from(products)
      .leftJoin(inventoryBalances, eq(inventoryBalances.productId, products.id))
      .where(and(eq(products.status, "ACTIVE"), isNull(products.deletedAt),
        sql`coalesce(${inventoryBalances.availableQuantity}, 0) <= ${threshold}`));
    return result?.total ?? 0;
  }
}
