import { inventoryMovementTypeSchema, type InventoryMovementType } from "@technology-ecommerce/api-schemas";
import { z } from "zod";

const pageSchema = z.coerce.number().int().min(1).max(1_000_000).catch(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).catch(20);
const movementPageSizeSchema = z.coerce.number().int().min(1).max(100).catch(10);
const sortOrderSchema = z.enum(["asc", "desc"]);
const balanceSortSchema = z.enum(["name", "sku", "status", "availableQuantity", "updatedAt"]);
const movementSortSchema = z.enum(["createdAt", "type", "quantityDelta", "balanceAfter"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type InventoryBalanceFilters = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  availability?: "IN_STOCK" | "OUT_OF_STOCK";
  status?: "ACTIVE" | "INACTIVE";
  sortBy: "name" | "sku" | "status" | "availableQuantity" | "updatedAt";
  sortOrder: "asc" | "desc";
}>;

export type InventoryMovementFilters = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  type?: InventoryMovementType;
  createdFrom?: string;
  createdTo?: string;
  sortBy: "createdAt" | "type" | "quantityDelta" | "balanceAfter";
  sortOrder: "asc" | "desc";
}>;

export function parseInventoryBalanceFilters(params: URLSearchParams): InventoryBalanceFilters {
  const search = params.get("search")?.trim().slice(0, 200);
  const status = z.enum(["ACTIVE", "INACTIVE"]).safeParse(params.get("status"));
  const availability = z.enum(["IN_STOCK", "OUT_OF_STOCK"]).safeParse(params.get("availability"));
  const sortBy = balanceSortSchema.safeParse(params.get("sortBy"));
  const sortOrder = sortOrderSchema.safeParse(params.get("sortOrder"));

  return {
    page: pageSchema.parse(params.get("page") ?? "1"),
    pageSize: pageSizeSchema.parse(params.get("pageSize") ?? "20"),
    sortBy: sortBy.success ? sortBy.data : "updatedAt",
    sortOrder: sortOrder.success ? sortOrder.data : "desc",
    ...(search ? { search } : {}),
    ...(status.success ? { status: status.data } : {}),
    ...(availability.success ? { availability: availability.data } : {}),
  };
}

export function inventoryBalanceFiltersToParams(filters: InventoryBalanceFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  if (filters.pageSize !== 20) params.set("pageSize", String(filters.pageSize));
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.sortBy !== "updatedAt") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") params.set("sortOrder", filters.sortOrder);
  return params;
}

export function parseInventoryMovementFilters(params: URLSearchParams): InventoryMovementFilters {
  const search = params.get("search")?.trim().slice(0, 200);
  const type = inventoryMovementTypeSchema.safeParse(params.get("type"));
  const createdFrom = dateSchema.safeParse(params.get("createdFrom"));
  const createdTo = dateSchema.safeParse(params.get("createdTo"));
  const sortBy = movementSortSchema.safeParse(params.get("sortBy"));
  const sortOrder = sortOrderSchema.safeParse(params.get("sortOrder"));

  return {
    page: pageSchema.parse(params.get("page") ?? "1"),
    pageSize: movementPageSizeSchema.parse(params.get("pageSize") ?? "10"),
    sortBy: sortBy.success ? sortBy.data : "createdAt",
    sortOrder: sortOrder.success ? sortOrder.data : "desc",
    ...(search ? { search } : {}),
    ...(type.success ? { type: type.data } : {}),
    ...(createdFrom.success ? { createdFrom: createdFrom.data } : {}),
    ...(createdTo.success ? { createdTo: createdTo.data } : {}),
  };
}

export function inventoryMovementFiltersToParams(filters: InventoryMovementFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  if (filters.pageSize !== 10) params.set("pageSize", String(filters.pageSize));
  if (filters.search) params.set("search", filters.search);
  if (filters.type) params.set("type", filters.type);
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  if (filters.sortBy !== "createdAt") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") params.set("sortOrder", filters.sortOrder);
  return params;
}
