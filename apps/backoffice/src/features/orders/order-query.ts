import { orderStatusSchema } from "@technology-ecommerce/api-schemas";
import { z } from "zod";
import type { AdministrativeOrderFilters } from "./order-api";

const pageSchema = z.coerce.number().int().min(1).max(1_000_000).catch(1);
const uuidSchema = z.uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const invoicingSchema = z.enum(["ACTIVE_INVOICE", "NO_ACTIVE_INVOICE"]);
const sortBySchema = z.enum(["createdAt", "number", "total", "status"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

function optional<T>(result: { success: boolean; data?: T }): T | undefined {
  return result.success ? result.data : undefined;
}

export function parseOrderFilters(params: URLSearchParams): AdministrativeOrderFilters {
  const search = params.get("search")?.trim();
  return {
    page: pageSchema.parse(params.get("page") ?? "1"), pageSize: 20,
    sortBy: optional(sortBySchema.safeParse(params.get("sortBy"))) ?? "createdAt",
    sortOrder: optional(sortOrderSchema.safeParse(params.get("sortOrder"))) ?? "desc",
    ...(search ? { search: search.slice(0, 200) } : {}),
    ...(optional(uuidSchema.safeParse(params.get("customerId"))) ? { customerId: params.get("customerId")! } : {}),
    ...(optional(orderStatusSchema.safeParse(params.get("status"))) ? { status: orderStatusSchema.parse(params.get("status")) } : {}),
    ...(optional(dateSchema.safeParse(params.get("createdFrom"))) ? { createdFrom: params.get("createdFrom")! } : {}),
    ...(optional(dateSchema.safeParse(params.get("createdTo"))) ? { createdTo: params.get("createdTo")! } : {}),
    ...(optional(invoicingSchema.safeParse(params.get("invoicing"))) ? { invoicing: invoicingSchema.parse(params.get("invoicing")) } : {}),
  };
}

export function filtersToSearchParams(filters: AdministrativeOrderFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  for (const key of ["search", "customerId", "status", "createdFrom", "createdTo", "invoicing"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.sortBy !== "createdAt") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") params.set("sortOrder", filters.sortOrder);
  return params;
}
