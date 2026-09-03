import { z } from "zod";

import { paginationMetadataSchema } from "./common";

export const productStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const productImageReferenceSchema = z
  .object({
    storageKey: z.string().trim().min(1).max(512),
    url: z.url().max(2_048),
  })
  .strict();

const productPriceSchema = z
  .string()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/);

export const createProductRequestSchema = z
  .object({
    currency: z.string().regex(/^[A-Za-z]{3}$/),
    description: z.string().trim().min(1).max(10_000),
    image: productImageReferenceSchema,
    name: z.string().trim().min(1).max(200),
    price: productPriceSchema,
    sku: z.string().trim().min(1).max(64),
    status: productStatusSchema.optional(),
  })
  .strict();

export const updateProductRequestSchema = createProductRequestSchema
  .omit({ status: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

export const updateProductStatusRequestSchema = z
  .object({ status: productStatusSchema })
  .strict();

export const administrativeProductSchema = z.object({
  id: z.uuid(),
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  price: productPriceSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  image: productImageReferenceSchema,
  status: productStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const productAvailabilitySchema = z.enum(["IN_STOCK", "OUT_OF_STOCK"]);
export const productListViewSchema = z.enum(["public", "administrative"]);
export const productSortFieldSchema = z.enum([
  "createdAt",
  "name",
  "price",
  "sku",
  "stockAvailable",
  "updatedAt",
]);

export const productListItemSchema = administrativeProductSchema
  .omit({ deletedAt: true })
  .extend({ stockAvailable: z.number().int().nonnegative() });

export const productDetailSchema = productListItemSchema.extend({
  availability: productAvailabilitySchema,
});

export const productPageSchema = paginationMetadataSchema.extend({
  items: z.array(productListItemSchema),
});

export const productListQuerySchema = z
  .object({
    availability: productAvailabilitySchema.optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
    maxPrice: productPriceSchema.optional(),
    minPrice: productPriceSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    sortBy: productSortFieldSchema.default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    status: productStatusSchema.optional(),
    view: productListViewSchema.default("public"),
  })
  .strict()
  .refine(
    ({ maxPrice, minPrice }) =>
      maxPrice === undefined ||
      minPrice === undefined ||
      Number(minPrice) <= Number(maxPrice),
  );

export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductImageReference = z.infer<typeof productImageReferenceSchema>;
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;
export type UpdateProductStatusRequest = z.infer<
  typeof updateProductStatusRequestSchema
>;
export type AdministrativeProduct = z.infer<typeof administrativeProductSchema>;
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type ProductListItem = z.infer<typeof productListItemSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductListView = z.infer<typeof productListViewSchema>;
export type ProductPage = z.infer<typeof productPageSchema>;
export type ProductSortField = z.infer<typeof productSortFieldSchema>;
