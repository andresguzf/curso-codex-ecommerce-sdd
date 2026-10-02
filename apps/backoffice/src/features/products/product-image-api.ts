import { createApiClient, type operations } from "@technology-ecommerce/api-client";
import {
  productGalleryImageSchema,
  updateProductImageRequestSchema,
  type ProductDetail,
  type ProductGalleryImage,
  type UpdateProductImageRequest,
} from "@technology-ecommerce/api-schemas";
import { z } from "zod";

import { getAdministrativeProduct, ProductApiError } from "./product-api";

const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const client = createApiClient({ baseUrl, credentials: "include" });
export type UploadProductImageMetadata = operations["addProductImage"]["parameters"]["query"];
type UploadedImageResponse = operations["addProductImage"]["responses"][201]["content"]["application/json"];
type ImagePatchBody = operations["updateProductImage"]["requestBody"]["content"]["application/json"];

const uploadMetadataSchema = z.object({
  altText: z.string().trim().min(1).max(500),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(2_147_483_646).optional(),
}).strict();
const idSchema = z.uuid();
const errorCodeSchema = z.object({ code: z.string() });

export class ProductImageApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    const messages: Record<string, string> = {
      PRODUCT_IMAGE_LIMIT_REACHED: "El producto admite como máximo cuatro imágenes, incluida la portada.",
      PRODUCT_PRIMARY_IMAGE_REQUIRED: "Selecciona otra portada antes de quitar la portada actual.",
      PRODUCT_IMAGE_ORDER_INVALID: "La posición de la imagen no es válida. Actualiza la galería.",
      PRODUCT_IMAGE_REQUEST_INVALID: "Revisa el archivo y los datos de la imagen.",
      PRODUCT_IMAGE_RESPONSE_INVALID: "La respuesta de imágenes no es válida. Actualiza la galería.",
    };
    // Never surface server messages, URLs, tokens or response bodies.
    super(status === 401 ? "Tu sesión venció. Inicia sesión nuevamente."
      : status === 403 ? "No tienes permisos para administrar imágenes."
        : status === 404 ? "El producto o la imagen ya no está disponible."
          : status === 413 ? "La imagen supera el tamaño permitido por el servidor."
            : (code && messages[code]) || (status === 400 ? "Revisa el formato y los datos de la imagen."
              : "No pudimos completar la operación de imágenes. Actualiza la galería antes de reintentar."));
    this.name = "ProductImageApiError";
  }
}

function failure(status: number, body: unknown): ProductImageApiError {
  const parsed = errorCodeSchema.safeParse(body);
  return new ProductImageApiError(status, parsed.success ? parsed.data.code : undefined);
}

function parseRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ProductImageApiError(400, "PRODUCT_IMAGE_REQUEST_INVALID");
  return parsed.data;
}

function parseImage(input: unknown): ProductGalleryImage {
  const parsed = productGalleryImageSchema.safeParse(input);
  if (!parsed.success) throw new ProductImageApiError(502, "PRODUCT_IMAGE_RESPONSE_INVALID");
  return parsed.data satisfies UploadedImageResponse;
}

async function safely<T>(action: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    if (error instanceof Error && error.name === "AbortError") throw error;
    if (error instanceof ProductImageApiError) throw error;
    if (error instanceof ProductApiError) throw new ProductImageApiError(error.status, error.code);
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      throw new ProductImageApiError(502, "PRODUCT_IMAGE_RESPONSE_INVALID");
    }
    throw new ProductImageApiError(0);
  }
}

/** Reads the complete ordered gallery, including inactive products, not just the list cover. */
export async function getAdministrativeProductGallery(
  accessToken: string, productId: string, signal?: AbortSignal,
): Promise<ProductDetail> {
  parseRequest(idSchema, productId);
  return safely(() => getAdministrativeProduct(accessToken, productId, signal), signal);
}

export async function uploadProductImage(
  accessToken: string, productId: string, file: Blob,
  metadata: UploadProductImageMetadata, signal?: AbortSignal,
): Promise<ProductGalleryImage> {
  parseRequest(idSchema, productId);
  const input = parseRequest(uploadMetadataSchema, metadata) satisfies UploadProductImageMetadata;
  if (!file.size || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new ProductImageApiError(400, "PRODUCT_IMAGE_REQUEST_INVALID");
  }
  const query = new URLSearchParams({ altText: input.altText });
  if (input.isPrimary !== undefined) query.set("isPrimary", String(input.isPrimary));
  if (input.sortOrder !== undefined) query.set("sortOrder", String(input.sortOrder));
  return safely(async () => {
    // OpenAPI represents binary bodies as string; send Blob bytes without a
    // string cast, JSON serialization or multipart envelope. No retry here.
    const response = await fetch(`${baseUrl}/api/v1/products/${productId}/images?${query}`, {
      method: "POST", credentials: "include", signal,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) throw failure(response.status, await response.json().catch(() => null));
    return parseImage(await response.json());
  }, signal);
}

export async function updateProductImage(
  accessToken: string, productId: string, imageId: string,
  input: UpdateProductImageRequest, signal?: AbortSignal,
): Promise<ProductGalleryImage> {
  parseRequest(idSchema, productId);
  parseRequest(idSchema, imageId);
  const body = parseRequest(updateProductImageRequestSchema, input) satisfies ImagePatchBody;
  return safely(async () => {
    const result = await client.PATCH("/api/v1/products/{productId}/images/{imageId}", {
      headers: { Authorization: `Bearer ${accessToken}` }, signal,
      params: { path: { productId, imageId } }, body,
    });
    if (!result.response.ok) throw failure(result.response.status, result.error);
    return parseImage(result.data);
  }, signal);
}

export async function deleteProductImage(
  accessToken: string, productId: string, imageId: string, signal?: AbortSignal,
): Promise<void> {
  parseRequest(idSchema, productId);
  parseRequest(idSchema, imageId);
  return safely(async () => {
    const result = await client.DELETE("/api/v1/products/{productId}/images/{imageId}", {
      headers: { Authorization: `Bearer ${accessToken}` }, signal,
      params: { path: { productId, imageId } },
    });
    if (!result.response.ok) throw failure(result.response.status, result.error);
    if (result.response.status !== 204) throw new ProductImageApiError(502, "PRODUCT_IMAGE_RESPONSE_INVALID");
  }, signal);
}
