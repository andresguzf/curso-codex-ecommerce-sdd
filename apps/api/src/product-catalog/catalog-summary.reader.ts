import { Injectable } from "@nestjs/common";
import { and, count, eq, isNull } from "drizzle-orm";
import type { DatabaseTransaction } from "../database/database.service.js";
import { products } from "../database/schema/index.js";

@Injectable()
export class CatalogSummaryReader {
  async countActiveProducts(transaction: DatabaseTransaction): Promise<number> {
    const [result] = await transaction.select({ total: count() }).from(products)
      .where(and(eq(products.status, "ACTIVE"), isNull(products.deletedAt)));
    return result?.total ?? 0;
  }
}
