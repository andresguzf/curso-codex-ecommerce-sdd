import { createApiClient } from "@technology-ecommerce/api-client";
import {
  productDetailSchema,
  productPageSchema,
  type ProductDetail,
  type ProductPage,
} from "@technology-ecommerce/api-schemas";

import type { CatalogQuery } from "./catalog-query";

const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
});

export class PublicProductNotFoundError extends Error {
  constructor() {
    super("El producto no existe o no está disponible públicamente.");
    this.name = "PublicProductNotFoundError";
  }
}

export async function getPublicProducts(query: CatalogQuery): Promise<ProductPage> {
  const { data, error } = await apiClient.GET("/api/v1/products", {
    params: {
      query: {
        availability: query.availability,
        maxPrice: query.maxPrice,
        minPrice: query.minPrice,
        page: query.page,
        pageSize: 9,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        view: "public",
      },
    },
  });

  if (error || !data) {
    throw new Error("No fue posible cargar el catálogo.");
  }

  const page = productPageSchema.parse(data);
  return {
    ...page,
    items: page.items.filter((product) => product.status === "ACTIVE"),
  };
}

export async function getPublicProduct(productId: string): Promise<ProductDetail> {
  const { data, error, response } = await apiClient.GET(
    "/api/v1/products/{productId}",
    {
      params: {
        path: { productId },
        query: { view: "public" },
      },
    },
  );

  if (response.status === 404) {
    throw new PublicProductNotFoundError();
  }

  if (error || !data) {
    throw new Error("No fue posible cargar el producto.");
  }

  return productDetailSchema.parse(data);
}
