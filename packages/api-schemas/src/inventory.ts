import { z } from "zod";

import { paginationMetadataSchema } from "./common";

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

export const inventoryMovementTypeSchema = z.enum([
  "OPENING",
  "ADJUSTMENT",
  "SALE",
  "CANCELLATION",
]);

export const inventoryMovementActorSchema = z.object({
  id: z.uuid(),
  displayName: z.string().trim().min(1),
  email: z.email(),
});

export const inventoryMovementSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  type: inventoryMovementTypeSchema,
  quantityDelta: z.number().int().refine((quantity) => quantity !== 0),
  balanceAfter: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(500),
  referenceType: z.string().trim().min(1).nullable(),
  referenceId: z.string().trim().min(1).nullable(),
  actor: inventoryMovementActorSchema.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const inventoryMovementPageSchema = paginationMetadataSchema.extend({
  items: z.array(inventoryMovementSchema),
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
export type InventoryMovementType = z.infer<typeof inventoryMovementTypeSchema>;
export type InventoryMovementActor = z.infer<typeof inventoryMovementActorSchema>;
export type InventoryMovement = z.infer<typeof inventoryMovementSchema>;
export type InventoryMovementPage = z.infer<typeof inventoryMovementPageSchema>;
