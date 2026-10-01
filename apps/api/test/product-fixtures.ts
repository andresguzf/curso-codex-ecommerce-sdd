import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../src/database/schema";
import type { NewProduct, Product } from "../src/database/schema";

/** Valid fixtures obey the same commit-time cover invariant as production. */
export function insertProductFixtures(
  database: NodePgDatabase<typeof schema>,
  inputs: NewProduct | NewProduct[],
  image?: (product: Product) => { storageKey: string; url: string },
) {
  return database.transaction(async (transaction) => {
    const rows = await transaction.insert(schema.products).values(Array.isArray(inputs) ? inputs : [inputs]).returning();
    await transaction.insert(schema.productImages).values(rows.map((product) => ({
      productId: product.id,
      altText: product.name,
      ...(image?.(product) ?? { storageKey: `fixtures/${product.id}`, url: "/images/product-placeholder.svg" }),
    })));
    return rows;
  });
}
