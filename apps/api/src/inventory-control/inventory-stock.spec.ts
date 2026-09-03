import { describe, expect, it } from "vitest";

import { normalizeInventoryStockItems } from "./inventory-stock.service";

describe("normalizeInventoryStockItems", () => {
  it("consolidates duplicate products and sorts locks by product id", () => {
    expect(
      normalizeInventoryStockItems([
        { productId: "product-c", quantity: 1 },
        { productId: "product-a", quantity: 2 },
        { productId: "product-c", quantity: 3 },
        { productId: "product-b", quantity: 1 },
      ]),
    ).toEqual([
      { productId: "product-a", quantity: 2 },
      { productId: "product-b", quantity: 1 },
      { productId: "product-c", quantity: 4 },
    ]);
  });

  it("rejects empty batches and invalid quantities", () => {
    expect(() => normalizeInventoryStockItems([])).toThrow(TypeError);
    expect(() =>
      normalizeInventoryStockItems([{ productId: "product-a", quantity: 0 }]),
    ).toThrow(TypeError);
  });
});

