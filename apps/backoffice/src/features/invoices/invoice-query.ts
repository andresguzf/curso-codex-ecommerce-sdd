import { z } from "zod";

import {
  invoiceOriginSchema,
  invoiceStatusSchema,
} from "@technology-ecommerce/api-schemas";
import type { InvoiceFilters } from "./invoice-api";

const pageSchema = z.coerce.number().int().min(1).max(1_000_000).catch(1);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sortBySchema = z.enum(["createdAt", "number", "total", "status", "origin"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

export function parseInvoiceFilters(params: URLSearchParams): InvoiceFilters {
  const search = params.get("search")?.trim();
  const customerId = params.get("customerId")?.trim();
  return {
    page: pageSchema.parse(params.get("page") ?? "1"),
    pageSize: 20,
    sortBy: sortBySchema.catch("createdAt").parse(params.get("sortBy") ?? "createdAt"),
    sortOrder: sortOrderSchema.catch("desc").parse(params.get("sortOrder") ?? "desc"),
    ...(search ? { search: search.slice(0, 200) } : {}),
    ...(customerId && z.uuid().safeParse(customerId).success ? { customerId } : {}),
    ...(invoiceStatusSchema.safeParse(params.get("status")).success ? { status: invoiceStatusSchema.parse(params.get("status")) } : {}),
    ...(invoiceOriginSchema.safeParse(params.get("origin")).success ? { origin: invoiceOriginSchema.parse(params.get("origin")) } : {}),
    ...(dateSchema.safeParse(params.get("createdFrom")).success ? { createdFrom: params.get("createdFrom")! } : {}),
    ...(dateSchema.safeParse(params.get("createdTo")).success ? { createdTo: params.get("createdTo")! } : {}),
  };
}

export function invoiceFiltersToSearchParams(filters: InvoiceFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  for (const key of ["search", "customerId", "status", "origin", "createdFrom", "createdTo"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (filters.sortBy !== "createdAt") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") params.set("sortOrder", filters.sortOrder);
  return params;
}
