import { createApiClient } from "@technology-ecommerce/api-client";
import {
  administrativeProductSchema,
  productPageSchema,
  type AdministrativeProduct,
  type CreateProductRequest,
  type ProductPage,
  type UpdateProductRequest,
  type UpdateProductStatusRequest,
} from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export class ProductApiError extends Error {
  constructor(readonly status: number) {
    super(
      status === 409
        ? "Ya existe un producto con ese SKU o referencia de imagen."
        : status === 403
          ? "No tienes permisos para administrar productos."
          : "No pudimos completar la operación. Inténtalo nuevamente.",
    );
    this.name = "ProductApiError";
  }
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listAdministrativeProducts(
  accessToken: string,
  page: number,
): Promise<ProductPage> {
  const result = await client.GET("/api/v1/products", {
    headers: authorization(accessToken),
    params: {
      query: {
        page,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
        view: "administrative",
      },
    },
  });
  if (!result.data) throw new ProductApiError(result.response.status);
  return productPageSchema.parse(result.data);
}

export async function createProduct(
  accessToken: string,
  input: CreateProductRequest,
): Promise<AdministrativeProduct> {
  const result = await client.POST("/api/v1/products", {
    body: { ...input, status: input.status ?? "INACTIVE" },
    headers: authorization(accessToken),
  });
  if (!result.data) throw new ProductApiError(result.response.status);
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
  if (!result.data) throw new ProductApiError(result.response.status);
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
