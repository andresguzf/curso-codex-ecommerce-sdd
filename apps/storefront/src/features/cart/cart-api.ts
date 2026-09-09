import { createApiClient } from "@technology-ecommerce/api-client";
import {
  activeCartSchema,
  cartClaimResultSchema,
  cartOperationErrorSchema,
  type ActiveCart,
  type CartClaimResult,
} from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export class CartApiError extends Error {
  readonly code?: string;

  constructor(readonly status: number, payload?: unknown) {
    const parsed = cartOperationErrorSchema.safeParse(payload);
    const error = parsed.success ? parsed.data : undefined;
    super(cartErrorMessage(status, error));
    this.code = error?.code;
    this.name = "CartApiError";
  }
}

function cartErrorMessage(
  status: number,
  error?: Readonly<{
    code: string;
    details?: Readonly<{
      availableQuantity?: number;
    }>;
  }>,
): string {
  if (error?.code === "CART_INSUFFICIENT_STOCK") {
    return error.details?.availableQuantity === undefined
      ? "El stock cambió. Revisa la disponibilidad actualizada."
      : `Solo hay ${error.details.availableQuantity} unidades disponibles.`;
  }
  if (error?.code === "CART_PRODUCT_UNAVAILABLE") {
    return "Este producto ya no está disponible para comprar.";
  }
  if (status === 404) return "Ese producto ya no está en tu carrito.";
  if (status === 409) return "No pudimos agregar esa cantidad al carrito.";
  return "No pudimos actualizar tu carrito. Inténtalo nuevamente.";
}

function authorization(accessToken?: string) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

function requireCart(
  data: unknown,
  status: number,
  error?: unknown,
): ActiveCart {
  if (!data) throw new CartApiError(status, error);
  return activeCartSchema.parse(data);
}

export async function getCart(accessToken?: string): Promise<ActiveCart> {
  const result = await client.GET("/api/v1/cart", {
    signal: AbortSignal.timeout(10_000),
    headers: authorization(accessToken),
  });
  return requireCart(result.data, result.response.status, result.error);
}

export async function addCartItem(
  accessToken: string | undefined,
  productId: string,
  quantity: number,
): Promise<ActiveCart> {
  const result = await client.POST("/api/v1/cart/items", {
    signal: AbortSignal.timeout(10_000),
    body: { productId, quantity },
    headers: authorization(accessToken),
  });
  return requireCart(result.data, result.response.status, result.error);
}

export async function updateCartItem(
  accessToken: string | undefined,
  itemId: string,
  quantity: number,
): Promise<ActiveCart> {
  const result = await client.PATCH("/api/v1/cart/items/{itemId}", {
    signal: AbortSignal.timeout(10_000),
    body: { quantity },
    headers: authorization(accessToken),
    params: { path: { itemId } },
  });
  return requireCart(result.data, result.response.status, result.error);
}

export async function removeCartItem(
  accessToken: string | undefined,
  itemId: string,
): Promise<ActiveCart> {
  const result = await client.DELETE("/api/v1/cart/items/{itemId}", {
    signal: AbortSignal.timeout(10_000),
    headers: authorization(accessToken),
    params: { path: { itemId } },
  });
  return requireCart(result.data, result.response.status, result.error);
}

export async function claimAnonymousCart(
  accessToken: string,
): Promise<CartClaimResult> {
  const result = await client.POST("/api/v1/cart/claim", {
    signal: AbortSignal.timeout(10_000),
    headers: authorization(accessToken),
  });
  if (!result.data) throw new CartApiError(result.response.status, result.error);
  return cartClaimResultSchema.parse(result.data);
}
