import { z } from "zod";

import { paginationMetadataSchema } from "./common";

export const productStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const systemCurrencySchema = z.literal("USD");
export const productSlugSchema = z.string().trim().min(1).max(220);

export const productImageReferenceSchema = z
  .object({
    storageKey: z.string().trim().min(1).max(512),
    // A reference can be a managed absolute URL or a relative local fallback.
    url: z.string().trim().min(1).max(2_048),
  })
  .strict();

export const createProductImageReferenceSchema = productImageReferenceSchema
  .partial();

const productPriceSchema = z
  .string()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/);

export const createProductRequestSchema = z
  .object({
    categoryId: z.uuid().nullable().optional(),
    description: z.string().trim().min(1).max(10_000),
    image: createProductImageReferenceSchema.optional(),
    name: z.string().trim().min(1).max(200),
    price: productPriceSchema,
    sku: z.string().trim().min(1).max(64),
    slug: productSlugSchema.optional(),
    tagIds: z.array(z.uuid()).max(20).refine((ids) => new Set(ids).size === ids.length).optional(),
    tagNames: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    status: productStatusSchema.optional(),
  })
  .strict();

export const updateProductRequestSchema = createProductRequestSchema
  .omit({ status: true, image: true })
  .partial()
  .extend({ image: productImageReferenceSchema.optional(), isFeatured: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0);

export const updateProductStatusRequestSchema = z
  .object({ status: productStatusSchema })
  .strict();

export const productClassificationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: productStatusSchema,
});

export const administrativeProductSchema = z.object({
  isFeatured: z.boolean().optional(),
  featuredAt: z.iso.datetime({ offset: true }).nullable().optional(),
  id: z.uuid(),
  slug: productSlugSchema.nullable(),
  category: productClassificationSchema.nullable(),
  tags: z.array(productClassificationSchema),
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  price: productPriceSchema,
  currency: systemCurrencySchema,
  image: productImageReferenceSchema,
  status: productStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const productAvailabilitySchema = z.enum(["IN_STOCK", "OUT_OF_STOCK"]);
export const catalogImageSchema = z.object({
  id: z.uuid(), storageKey: z.string().min(1), url: z.string().min(1),
  altText: z.string().min(1), isPrimary: z.boolean(), sortOrder: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(), height: z.number().int().positive().nullable(),
  mimeType: z.string().nullable(),
}).strict();
export type CatalogImage = z.infer<typeof catalogImageSchema>;
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
  .extend({ stockAvailable: z.number().int().nonnegative(), coverImage: catalogImageSchema.nullable() });

export const productDetailSchema = productListItemSchema.extend({
  availability: productAvailabilitySchema,
  images: z.array(catalogImageSchema),
});

export const productPageSchema = paginationMetadataSchema.extend({
  items: z.array(productListItemSchema),
});

export const productListQuerySchema = z
  .object({
    purpose: z.literal("autocomplete").optional(),
    createdFrom: z.iso.date().optional(),
    createdTo: z.iso.date().optional(),
    availability: productAvailabilitySchema.optional(),
    categoryId: z.uuid().optional(),
    tagIds: z.array(z.uuid()).min(1).max(20).refine((ids) => new Set(ids).size === ids.length).optional(),
    maxPrice: productPriceSchema.optional(),
    minPrice: productPriceSchema.optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    sortBy: productSortFieldSchema.default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    status: productStatusSchema.optional(),
    view: productListViewSchema.default("public"),
  })
  .strict()
  .refine((query) => query.purpose !== "autocomplete" || (
    (query.search?.length ?? 0) >= 3 && query.pageSize <= 20 && query.view === "public" && !query.status
  ))
  .refine(({ createdFrom, createdTo }) => !createdFrom || !createdTo || createdFrom <= createdTo)
  .refine(({ createdFrom, createdTo, view }) => (!createdFrom && !createdTo) || view === "administrative")
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
