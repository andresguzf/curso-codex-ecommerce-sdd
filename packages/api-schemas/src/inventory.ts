import { z } from "zod";

export const inventoryAdjustmentRequestSchema = z
  .object({
    quantityDelta: z
      .number()
      .int()
      .min(-2_147_483_647)
      .max(2_147_483_647)
      .refine((quantity) => quantity !== 0),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const inventoryAdjustmentMovementSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  type: z.literal("ADJUSTMENT"),
  quantityDelta: z.number().int(),
  balanceAfter: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(500),
  actorUserId: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const inventoryAdjustmentResponseSchema = z.object({
  productId: z.uuid(),
  availableQuantity: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime({ offset: true }),
  movement: inventoryAdjustmentMovementSchema,
});

export type InventoryAdjustmentRequest = z.infer<
  typeof inventoryAdjustmentRequestSchema
>;
export type InventoryAdjustmentMovement = z.infer<
  typeof inventoryAdjustmentMovementSchema
>;
export type InventoryAdjustmentResponse = z.infer<
  typeof inventoryAdjustmentResponseSchema
>;
