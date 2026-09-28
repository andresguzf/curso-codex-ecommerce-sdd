import { categoryPageSchema, tagPageSchema, type Category, type Tag } from "@technology-ecommerce/api-schemas";

import { createApiClient } from "./client";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
});

export async function getActiveCategories(signal?: AbortSignal): Promise<Category[]> {
  const items: Category[] = [];
  for (let page = 1; ; page += 1) {
    const result = await client.GET("/api/v1/categories", {
      params: { query: { page, pageSize: 100, sortBy: "name", sortOrder: "asc", view: "public" } },
      signal,
    });
    if (!result.data) throw new Error("No fue posible cargar las categorías.");
    const response = categoryPageSchema.parse(result.data);
    items.push(...response.items.filter((item) => item.status === "ACTIVE"));
    if (page >= response.totalPages) return items;
  }
}

export async function getActiveTags(signal?: AbortSignal): Promise<Tag[]> {
  const items: Tag[] = [];
  for (let page = 1; ; page += 1) {
    const result = await client.GET("/api/v1/tags", {
      params: { query: { page, pageSize: 100, sortBy: "name", sortOrder: "asc", view: "public" } },
      signal,
    });
    if (!result.data) throw new Error("No fue posible cargar las etiquetas.");
    const response = tagPageSchema.parse(result.data);
    items.push(...response.items.filter((item) => item.status === "ACTIVE"));
    if (page >= response.totalPages) return items;
  }
}
