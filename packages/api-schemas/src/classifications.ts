import { z } from "zod";

import { paginationMetadataSchema } from "./common";

export const classificationStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);
export const classificationSortFieldSchema = z.enum(["createdAt", "updatedAt", "name", "slug", "status"]);
const baseRecordSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: classificationStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const categorySchema = baseRecordSchema.extend({ description: z.string() });
export const tagSchema = baseRecordSchema;
export const categoryPageSchema = paginationMetadataSchema.extend({ items: z.array(categorySchema) });
export const tagPageSchema = paginationMetadataSchema.extend({ items: z.array(tagSchema) });

export const classificationListQuerySchema = z.object({
  page: z.number().int().min(1).max(1_000_000),
  pageSize: z.number().int().min(1).max(100),
  search: z.string().trim().min(1).max(200).optional(),
  status: classificationStatusSchema.optional(),
  sortBy: classificationSortFieldSchema,
  sortOrder: z.enum(["asc", "desc"]),
  view: z.enum(["public", "administrative"]).optional(),
});

const classificationNameSchema = z.string().trim().min(1);
const classificationSlugSchema = z.string().trim().min(1);
export const createCategoryRequestSchema = z.object({
  name: classificationNameSchema.max(200),
  slug: classificationSlugSchema.max(220).optional(),
  description: z.string().trim().max(10_000).optional(),
  status: classificationStatusSchema.optional(),
}).strict();
export const updateCategoryRequestSchema = createCategoryRequestSchema.partial()
  .refine((value) => Object.keys(value).length > 0);
export const createTagRequestSchema = z.object({
  name: classificationNameSchema.max(120),
  slug: classificationSlugSchema.max(140).optional(),
  status: classificationStatusSchema.optional(),
}).strict();
export const updateTagRequestSchema = createTagRequestSchema.partial()
  .refine((value) => Object.keys(value).length > 0);

const nameSchema = z.string().trim().min(1, "Ingresa un nombre.");
const slugSchema = z.string().trim().max(220).refine(
  (value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
  "Usa letras minúsculas, números y guiones.",
);

export const categoryFormSchema = z.object({
  name: nameSchema.max(200),
  slug: slugSchema,
  description: z.string().trim().max(10_000),
});
export const tagFormSchema = z.object({
  name: nameSchema.max(120),
  slug: slugSchema.max(140),
});

export type Category = z.infer<typeof categorySchema>;
export type Tag = z.infer<typeof tagSchema>;
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;
export type CreateTagRequest = z.infer<typeof createTagRequestSchema>;
export type UpdateTagRequest = z.infer<typeof updateTagRequestSchema>;
export type ClassificationStatus = z.infer<typeof classificationStatusSchema>;
export type ClassificationListQuery = z.infer<typeof classificationListQuerySchema>;
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
export type TagFormValues = z.infer<typeof tagFormSchema>;
