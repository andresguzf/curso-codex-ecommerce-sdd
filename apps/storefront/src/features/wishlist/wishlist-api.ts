import { createApiClient } from "@technology-ecommerce/api-client";
import {
  addWishlistItemResultSchema,
  wishlistPageSchema,
  type WishlistPage,
} from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export class WishlistApiError extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? "Tu sesión venció. Vuelve a iniciar sesión."
      : status === 403 ? "La lista de deseos está disponible para clientes."
        : status === 404 ? "El producto ya no está disponible en el catálogo."
          : "No pudimos actualizar tus deseos. Inténtalo nuevamente.");
    this.name = "WishlistApiError";
  }
}

function options(token: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(10_000);
  return {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store" as const,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  };
}

export async function getWishlistPage(token: string, page: number, pageSize = 12, signal?: AbortSignal): Promise<WishlistPage> {
  const result = await client.GET("/api/v1/wishlist", {
    ...options(token, signal),
    params: { query: { page, pageSize } },
  });
  if (!result.data) throw new WishlistApiError(result.response.status);
  return wishlistPageSchema.parse(result.data);
}

// Membership is derived from the paginated REST resource. Query caching and
// deduplication keep all visible cards on one request chain per customer.
export async function getWishlistProductIds(token: string, signal?: AbortSignal): Promise<ReadonlySet<string>> {
  const ids = new Set<string>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const result = await getWishlistPage(token, page, 100, signal);
    for (const item of result.items) ids.add(item.productId);
    totalPages = result.totalPages;
    page += 1;
  }
  return ids;
}

export async function addWishlistItem(token: string, productId: string): Promise<boolean> {
  const result = await client.POST("/api/v1/wishlist/items", {
    ...options(token),
    body: { productId },
  });
  if (!result.data) throw new WishlistApiError(result.response.status);
  return addWishlistItemResultSchema.parse(result.data).added;
}

export async function removeWishlistItem(token: string, productId: string): Promise<void> {
  const result = await client.DELETE("/api/v1/wishlist/items/{productId}", {
    ...options(token),
    params: { path: { productId } },
  });
  if (result.response.status !== 204) throw new WishlistApiError(result.response.status);
}
