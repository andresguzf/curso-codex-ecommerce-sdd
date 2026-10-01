import { z } from "zod";

export const productGalleryImageSchema = z.object({
  id: z.uuid(), productId: z.uuid(), storageKey: z.string().min(1), url: z.string().min(1),
  altText: z.string().min(1), isPrimary: z.boolean(), sortOrder: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(),
  mimeType: z.string().nullable(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).strict();
export const updateProductImageRequestSchema = z.object({
  altText: z.string().trim().min(1).max(500).optional(), isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(2_147_483_646).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
export type ProductGalleryImage = z.infer<typeof productGalleryImageSchema>;
export type UpdateProductImageRequest = z.infer<typeof updateProductImageRequestSchema>;
