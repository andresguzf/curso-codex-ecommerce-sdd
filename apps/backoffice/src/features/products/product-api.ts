import { createApiClient } from "@technology-ecommerce/api-client";
import {
  administrativeProductSchema,
  productDetailSchema,
  productPageSchema,
  type AdministrativeProduct,
  type CreateProductRequest,
  type ProductPage,
  type UpdateProductRequest,
  type UpdateProductStatusRequest,
} from "@technology-ecommerce/api-schemas";
import { z } from "zod";

import type { ProductAdminFilters } from "./product-query";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export class ProductApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(productErrorMessage(status, code));
    this.name = "ProductApiError";
  }
}

function productErrorMessage(status: number, code?: string): string {
  const messages: Record<string, string> = {
    PRODUCT_CATEGORY_REQUIRED: "Selecciona una categoría para activar el producto.",
    PRODUCT_CLASSIFICATION_UNAVAILABLE: "La categoría o una etiqueta seleccionada ya no está activa.",
    PRODUCT_SLUG_ALREADY_EXISTS: "Ese slug de producto ya está en uso.",
    PRODUCT_SLUG_INVALID: "El slug del producto no es válido.",
    PRODUCT_TAG_LIMIT_EXCEEDED: "Selecciona como máximo 20 etiquetas distintas.",
    PRODUCT_TAG_INACTIVE: "Una etiqueta escrita ya no está activa.",
    PRODUCT_TAG_NAME_INVALID: "Escribe nombres de etiquetas válidos.",
  };
  if (code && messages[code]) return messages[code];
  if (status === 409) return "Ya existe un producto con ese SKU o referencia de imagen.";
  if (status === 403) return "No tienes permisos para administrar productos.";
  return "No pudimos completar la operación. Inténtalo nuevamente.";
}

const errorCodeSchema = z.object({ code: z.string() });

function productFailure(result: { error?: unknown; response: Response }): ProductApiError {
  const parsed = errorCodeSchema.safeParse(result.error);
  return new ProductApiError(result.response.status, parsed.success ? parsed.data.code : undefined);
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listAdministrativeProducts(
  accessToken: string,
  filters: ProductAdminFilters,
  signal?: AbortSignal,
): Promise<ProductPage> {
  const { tagIds, ...query } = filters;
  const result = await client.GET("/api/v1/products", {
    headers: authorization(accessToken),
    signal,
    params: {
      query: {
        ...query,
        ...(tagIds?.length ? { tagIds: tagIds.join(",") } : {}),
        view: "administrative",
      },
    },
  });
  if (!result.data) throw productFailure(result);
  return productPageSchema.parse(result.data);
}

export async function getAdministrativeProduct(
  accessToken: string,
  productId: string,
) {
  const result = await client.GET("/api/v1/products/{productId}", {
    headers: authorization(accessToken),
    params: { path: { productId }, query: { view: "administrative" } },
  });
  if (!result.data) throw productFailure(result);
  return productDetailSchema.parse(result.data);
}

export async function createProduct(
  accessToken: string,
  input: CreateProductRequest,
): Promise<AdministrativeProduct> {
  const result = await client.POST("/api/v1/products", {
    body: { ...input, status: input.status ?? "INACTIVE" },
    headers: authorization(accessToken),
  });
  if (!result.data) throw productFailure(result);
  return administrativeProductSchema.parse(result.data);
}

export async function updateProduct(
  accessToken: string,
  productId: string,
  input: UpdateProductRequest,
): Promise<AdministrativeProduct> {
  const result = await client.PATCH("/api/v1/products/{productId}", {
    body: input,
    headers: authorization(accessToken),
    params: { path: { productId } },
  });
  if (!result.data) throw productFailure(result);
  return administrativeProductSchema.parse(result.data);
}

export async function updateProductStatus(
  accessToken: string,
  productId: string,
  input: UpdateProductStatusRequest,
): Promise<AdministrativeProduct> {
  const result = await client.PATCH("/api/v1/products/{productId}/status", {
    body: input,
    headers: authorization(accessToken),
    params: { path: { productId } },
  });
  if (!result.data) throw new ProductApiError(result.response.status);
  return administrativeProductSchema.parse(result.data);
}

export async function deleteProduct(
  accessToken: string,
  productId: string,
): Promise<void> {
  const result = await client.DELETE("/api/v1/products/{productId}", {
    headers: authorization(accessToken),
    params: { path: { productId } },
  });
  if (!result.response.ok) throw new ProductApiError(result.response.status);
}
