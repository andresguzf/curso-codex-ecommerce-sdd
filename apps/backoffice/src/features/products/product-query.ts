import {
  productAvailabilitySchema,
  productSortFieldSchema,
  productStatusSchema,
} from "@technology-ecommerce/api-schemas";
import { z } from "zod";

const pageSchema = z.coerce.number().int().min(1).max(1_000_000).catch(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).catch(10);
const sortOrderSchema = z.enum(["asc", "desc"]);
const uuidSchema = z.uuid();
const filterPriceSchema = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const filterDateSchema = z.iso.date();
const tagIdsSchema = z.array(uuidSchema).min(1).max(20).refine((ids) => new Set(ids).size === ids.length);

export type ProductAdminFilters = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  availability?: "IN_STOCK" | "OUT_OF_STOCK";
  minPrice?: string;
  maxPrice?: string;
  categoryId?: string;
  tagIds?: readonly string[];
  createdFrom?: string;
  createdTo?: string;
  sortBy: "createdAt" | "name" | "price" | "sku" | "stockAvailable" | "updatedAt";
  sortOrder: "asc" | "desc";
}>;

export function parseProductAdminFilters(params: URLSearchParams): ProductAdminFilters {
  const search = params.get("search")?.trim().slice(0, 200);
  const status = productStatusSchema.safeParse(params.get("status"));
  const availability = productAvailabilitySchema.safeParse(params.get("availability"));
  const minPrice = filterPriceSchema.safeParse(params.get("minPrice"));
  const maxPrice = filterPriceSchema.safeParse(params.get("maxPrice"));
  const categoryId = uuidSchema.safeParse(params.get("categoryId"));
  const rawTagIds = params.get("tagIds");
  const tagIds = rawTagIds ? tagIdsSchema.safeParse(rawTagIds.split(",").filter(Boolean)) : undefined;
  const createdFrom = filterDateSchema.safeParse(params.get("createdFrom"));
  const createdTo = filterDateSchema.safeParse(params.get("createdTo"));
  const sortBy = productSortFieldSchema.safeParse(params.get("sortBy"));
  const sortOrder = sortOrderSchema.safeParse(params.get("sortOrder"));
  const validPriceRange = minPrice.success && maxPrice.success && Number(minPrice.data) > Number(maxPrice.data)
    ? false
    : true;
  const validDateRange = createdFrom.success && createdTo.success && createdFrom.data > createdTo.data
    ? false
    : true;

  return {
    page: pageSchema.parse(params.get("page") ?? "1"),
    pageSize: pageSizeSchema.parse(params.get("pageSize") ?? "10"),
    sortBy: sortBy.success ? sortBy.data : "createdAt",
    sortOrder: sortOrder.success ? sortOrder.data : "desc",
    ...(search ? { search } : {}),
    ...(status.success ? { status: status.data } : {}),
    ...(availability.success ? { availability: availability.data } : {}),
    ...(validPriceRange && minPrice.success ? { minPrice: minPrice.data } : {}),
    ...(validPriceRange && maxPrice.success ? { maxPrice: maxPrice.data } : {}),
    ...(categoryId.success ? { categoryId: categoryId.data } : {}),
    ...(tagIds?.success ? { tagIds: tagIds.data } : {}),
    ...(validDateRange && createdFrom.success ? { createdFrom: createdFrom.data } : {}),
    ...(validDateRange && createdTo.success ? { createdTo: createdTo.data } : {}),
  };
}

export function productAdminFiltersToParams(filters: ProductAdminFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  if (filters.pageSize !== 10) params.set("pageSize", String(filters.pageSize));
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.availability) params.set("availability", filters.availability);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.tagIds?.length) params.set("tagIds", filters.tagIds.join(","));
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  if (filters.sortBy !== "createdAt") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") params.set("sortOrder", filters.sortOrder);
  return params;
}
