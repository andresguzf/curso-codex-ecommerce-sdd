import { describe, expect, it } from "vitest";

import {
  inventoryAdjustmentRequestSchema,
  inventoryAdjustmentResponseSchema,
} from "../src/inventory";

describe("inventory HTTP schemas", () => {
  it("accepts signed non-zero adjustments with a mandatory reason", () => {
    expect(
      inventoryAdjustmentRequestSchema.parse({
        quantityDelta: -3,
        reason: "Damaged units",
      }),
    ).toEqual({ quantityDelta: -3, reason: "Damaged units" });
    expect(
      inventoryAdjustmentRequestSchema.safeParse({
        quantityDelta: 0,
        reason: "No change",
      }),
    ).toMatchObject({ success: false });
    expect(
      inventoryAdjustmentRequestSchema.safeParse({
        quantityDelta: 3,
        reason: "   ",
      }),
    ).toMatchObject({ success: false });
  });

  it("validates the resulting balance and auditable movement", () => {
    expect(
      inventoryAdjustmentResponseSchema.safeParse({
        productId: "8f732799-c098-45c1-961e-332c6becd13a",
        availableQuantity: 7,
        version: 2,
        updatedAt: "2026-09-03T12:00:00.000Z",
        movement: {
          id: "e7ce1166-8e4d-466a-8095-c5b4e100d031",
          productId: "8f732799-c098-45c1-961e-332c6becd13a",
          type: "ADJUSTMENT",
          quantityDelta: -3,
          balanceAfter: 7,
          reason: "Damaged units",
          actorUserId: "bfca235c-736a-4ee3-a360-a4562291213d",
          createdAt: "2026-09-03T12:00:00.000Z",
        },
      }).success,
    ).toBe(true);
  });
});
