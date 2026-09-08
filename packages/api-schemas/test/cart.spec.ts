import { describe, expect, it } from "vitest";

import {
  activeCartSchema,
  addCartItemRequestSchema,
  updateCartItemRequestSchema,
} from "../src/cart";

describe("cart schemas", () => {
  it("accepts positive integer quantities only", () => {
    const productId = "3296f1d5-5a1d-4b94-9caa-b26878f447e4";

    expect(addCartItemRequestSchema.safeParse({ productId, quantity: 1 }).success).toBe(true);
    expect(addCartItemRequestSchema.safeParse({ productId, quantity: 0 }).success).toBe(false);
    expect(updateCartItemRequestSchema.safeParse({ quantity: -1 }).success).toBe(false);
    expect(updateCartItemRequestSchema.safeParse({ quantity: 1.5 }).success).toBe(false);
  });

  it("validates authoritative fixed-precision cart totals", () => {
    const parsed = activeCartSchema.safeParse({
      id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
      customerId: "f69d57cb-3473-4ee4-8474-5d71aefbcbe5",
      status: "ACTIVE",
      items: [],
      totalQuantity: 0,
      currency: null,
      subtotal: "0.00",
      total: "0.00",
      createdAt: "2026-09-08T12:00:00.000Z",
      updatedAt: "2026-09-08T12:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects totals that are not normalized to two decimal places", () => {
    const parsed = activeCartSchema.safeParse({
      id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
      customerId: "f69d57cb-3473-4ee4-8474-5d71aefbcbe5",
      status: "ACTIVE",
      items: [],
      totalQuantity: 0,
      currency: null,
      subtotal: "0.0",
      total: "0.00",
      createdAt: "2026-09-08T12:00:00.000Z",
      updatedAt: "2026-09-08T12:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
  });
});
