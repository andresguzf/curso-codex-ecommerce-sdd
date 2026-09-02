import { z } from "zod";

export const apiErrorDetailSchema = z.object({
  code: z.string().trim().min(1).optional(),
  field: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1),
});

export const apiErrorSchema = z.object({
  code: z.string().trim().min(1),
  correlationId: z.string().trim().min(1),
  details: z.array(apiErrorDetailSchema).optional(),
  message: z.string().trim().min(1),
});

export const paginationMetadataSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type PaginationMetadata = z.infer<typeof paginationMetadataSchema>;
