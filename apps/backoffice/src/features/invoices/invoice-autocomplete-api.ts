import { createApiClient } from "@technology-ecommerce/api-client";
import { productPageSchema, userPageSchema } from "@technology-ecommerce/api-schemas";
import { z } from "zod";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});
const searchSchema = z.string().trim().min(3).max(200);
const customerLookupSchema = userPageSchema.refine((page) => page.items.length <= 20 && page.pageSize <= 20 && page.items.every((item) => item.role === "CUSTOMER" && item.status === "ACTIVE" && !item.deletedAt));
const productLookupSchema = productPageSchema.refine((page) => page.items.length <= 20 && page.pageSize <= 20 && page.items.every((item) => item.status === "ACTIVE"));

export async function searchInvoiceCustomers(accessToken: string, search: string, signal: AbortSignal) {
  const result = await client.GET("/api/v1/users", {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
    params: { query: { purpose: "autocomplete", search: searchSchema.parse(search), page: 1, pageSize: 20, sortBy: "displayName", sortOrder: "asc" } },
  });
  if (!result.data) throw new Error("No se pudo buscar clientes.");
  return customerLookupSchema.parse(result.data).items;
}

export async function searchInvoiceProducts(accessToken: string, search: string, signal: AbortSignal) {
  const result = await client.GET("/api/v1/products", {
    headers: { Authorization: `Bearer ${accessToken}` }, signal,
    params: { query: { purpose: "autocomplete", search: searchSchema.parse(search), page: 1, pageSize: 20, view: "public", sortBy: "name", sortOrder: "asc" } },
  });
  if (!result.data) throw new Error("No se pudo buscar productos.");
  return productLookupSchema.parse(result.data).items;
}
