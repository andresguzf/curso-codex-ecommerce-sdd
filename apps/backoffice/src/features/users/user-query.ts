import { userStatusSchema, type UserListQuery } from "@technology-ecommerce/api-schemas";
import { z } from "zod";

const roleSchema = z.enum(["CUSTOMER", "ADMIN", "BILLING"]);
const sortBySchema = z.enum(["createdAt", "displayName", "email", "role", "status"]);
const sortOrderSchema = z.enum(["asc", "desc"]);
const pageSchema = z.coerce.number().int().min(1).max(1_000_000).catch(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).catch(20);

export function parseUserFilters(params: URLSearchParams): UserListQuery {
  const search = params.get("search")?.trim().slice(0, 200);
  const role = roleSchema.safeParse(params.get("role"));
  const status = userStatusSchema.safeParse(params.get("status"));
  const sortBy = sortBySchema.safeParse(params.get("sortBy"));
  const sortOrder = sortOrderSchema.safeParse(params.get("sortOrder"));
  return {
    page: pageSchema.parse(params.get("page") ?? 1),
    pageSize: pageSizeSchema.parse(params.get("pageSize") ?? 20),
    sortBy: sortBy.success ? sortBy.data : "createdAt",
    sortOrder: sortOrder.success ? sortOrder.data : "desc",
    ...(search ? { search } : {}),
    ...(role.success ? { role: role.data } : {}),
    ...(status.success ? { status: status.data } : {}),
  };
}

export function userFiltersToParams(filters: UserListQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  if (filters.pageSize !== 20) params.set("pageSize", String(filters.pageSize));
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.sortBy !== "createdAt") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") params.set("sortOrder", filters.sortOrder);
  return params;
}
