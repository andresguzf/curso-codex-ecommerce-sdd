import { z } from "zod";

import { productImageReferenceSchema } from "./products";

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
  currency: z.string().regex(/^[A-Z]{3}$/),
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
  customerId: z.uuid(),
  status: z.literal("ACTIVE"),
  items: z.array(cartItemSchema),
  totalQuantity: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  subtotal: calculatedMoneySchema,
  total: calculatedMoneySchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>;
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>;
export type CartProduct = z.infer<typeof cartProductSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
export type ActiveCart = z.infer<typeof activeCartSchema>;
