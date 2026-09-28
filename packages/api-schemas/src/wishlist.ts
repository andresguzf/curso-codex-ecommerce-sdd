import { z } from "zod";

import { paginationMetadataSchema } from "./common";

export const wishlistProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string().nullable(),
  price: z.string(),
  currency: z.literal("USD"),
  image: z.object({ storageKey: z.string(), url: z.string() }).nullable(),
  stockAvailable: z.number().int().nonnegative(),
  isAvailable: z.boolean(),
});

export const wishlistItemSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  createdAt: z.iso.datetime({ offset: true }),
  productStatus: z.enum(["ACTIVE", "INACTIVE"]),
  productDeletedAt: z.iso.datetime({ offset: true }).nullable(),
  product: wishlistProductSchema,
});

export const wishlistPageSchema = paginationMetadataSchema.extend({ items: z.array(wishlistItemSchema) });
export const addWishlistItemRequestSchema = z.object({ productId: z.uuid() }).strict();
export const addWishlistItemResultSchema = z.object({ productId: z.uuid(), added: z.boolean() });

export type WishlistItem = z.infer<typeof wishlistItemSchema>;
export type WishlistPage = z.infer<typeof wishlistPageSchema>;
export type AddWishlistItemResult = z.infer<typeof addWishlistItemResultSchema>;
