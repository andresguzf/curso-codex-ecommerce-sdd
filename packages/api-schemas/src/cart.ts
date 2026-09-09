import { z } from "zod";

import { productImageReferenceSchema, systemCurrencySchema } from "./products";

const calculatedMoneySchema = z.string().regex(/^\d+\.\d{2}$/);

export const cartQuantitySchema = z
  .number()
  .int()
  .min(1)
  .max(2_147_483_647);

export const addCartItemRequestSchema = z
  .object({
    productId: z.uuid(),
    quantity: cartQuantitySchema,
  })
  .strict();

export const updateCartItemRequestSchema = z
  .object({ quantity: cartQuantitySchema })
  .strict();

export const cartProductSchema = z.object({
  id: z.uuid(),
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  price: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/),
  currency: systemCurrencySchema,
  image: productImageReferenceSchema,
  stockAvailable: z.number().int().nonnegative(),
  isAvailable: z.boolean(),
});

export const cartItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  quantity: cartQuantitySchema,
  subtotal: calculatedMoneySchema,
  product: cartProductSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const activeCartSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid().nullable(),
  status: z.literal("ACTIVE"),
  items: z.array(cartItemSchema),
  totalQuantity: z.number().int().nonnegative(),
  currency: systemCurrencySchema.nullable(),
  subtotal: calculatedMoneySchema,
  total: calculatedMoneySchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const cartClaimResultSchema = z.object({
  adjustedProductIds: z.array(z.uuid()),
  cart: activeCartSchema,
});

export const cartOperationErrorSchema = z
  .object({
    code: z.string().trim().min(1),
    details: z
      .object({
        availableQuantity: z.number().int().nonnegative().optional(),
        requestedQuantity: z.number().int().positive().optional(),
      })
      .passthrough()
      .optional(),
    message: z.string().optional(),
  })
  .passthrough();

export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>;
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>;
export type CartProduct = z.infer<typeof cartProductSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type ActiveCart = z.infer<typeof activeCartSchema>;
export type CartClaimResult = z.infer<typeof cartClaimResultSchema>;
export type CartOperationError = z.infer<typeof cartOperationErrorSchema>;
