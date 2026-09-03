import { z } from "zod";

import { authRoleSchema } from "./auth";
import { paginationMetadataSchema } from "./common";

export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]);

export const administrativeUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().trim().min(1),
  role: authRoleSchema,
  status: userStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
});

export const userPageSchema = paginationMetadataSchema.extend({
  items: z.array(administrativeUserSchema),
});

export const createUserRequestSchema = z
  .object({
    email: z.string().trim().email().max(320),
    displayName: z.string().trim().min(2).max(120),
    password: z.string().min(12).max(128),
    role: authRoleSchema,
    status: userStatusSchema.optional(),
  })
  .strict();

export const updateUserRequestSchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    displayName: z.string().trim().min(2).max(120).optional(),
    password: z.string().min(12).max(128).optional(),
    role: authRoleSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  role: authRoleSchema.optional(),
  status: userStatusSchema.optional(),
  sortBy: z
    .enum(["createdAt", "displayName", "email", "role", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AdministrativeUser = z.infer<typeof administrativeUserSchema>;
export type UserPage = z.infer<typeof userPageSchema>;
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
