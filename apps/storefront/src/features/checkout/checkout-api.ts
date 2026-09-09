import { createApiClient } from "@technology-ecommerce/api-client";
import {
  checkoutRequestSchema, checkoutResultSchema, checkoutShippingOptionsSchema,
  cartOperationErrorSchema,
  type CheckoutRequest,
} from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});
const messages: Record<string, string> = {
  PAYMENT_REJECTED: "El pago simulado fue rechazado. Elige otro método e inténtalo nuevamente.",
  CHECKOUT_INSUFFICIENT_STOCK: "El stock cambió. Revisa las cantidades en tu carrito antes de volver a comprar.",
  CHECKOUT_PRODUCT_UNAVAILABLE: "Un producto ya no está disponible. Revisa tu carrito.",
  CHECKOUT_CART_EMPTY: "Tu carrito está vacío. Agrega productos para continuar.",
  CHECKOUT_IN_PROGRESS: "La compra sigue en proceso. Reintenta para recuperar su resultado.",
  IDEMPOTENCY_KEY_REUSED: "Este intento corresponde a otra compra. Revisa tu carrito.",
  REQUEST_VALIDATION_FAILED: "Revisa los datos de dirección, envío y pago.",
};

export class CheckoutApiError extends Error {
  readonly uncertain: boolean;
  constructor(readonly status: number, readonly code?: string) {
    super(status === 401 ? "Tu sesión venció. Inicia sesión para continuar." :
      messages[code ?? ""] ?? "No pudimos confirmar el resultado. Reintenta la misma compra para evitar duplicados.");
    this.name = "CheckoutApiError";
    this.uncertain = status >= 500 || code === "CHECKOUT_IN_PROGRESS";
  }
}

export async function submitCheckout(token: string, input: CheckoutRequest, key: string) {
  const result = await client.POST("/api/v1/checkout", {
    body: checkoutRequestSchema.parse(input),
    headers: { Authorization: `Bearer ${token}` },
    params: { header: { "Idempotency-Key": key } },
  });
  if (!result.data) {
    const parsed = cartOperationErrorSchema.safeParse(result.error);
    throw new CheckoutApiError(result.response.status, parsed.success ? parsed.data.code : undefined);
  }
  return checkoutResultSchema.parse(result.data);
}

export async function getCheckoutShippingOptions(token: string) {
  const result = await client.GET("/api/v1/checkout/shipping-methods", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!result.data) throw new Error("No se pudieron cargar las opciones de envío.");
  return checkoutShippingOptionsSchema.parse(result.data);
}

export async function getCheckoutReceipt(token: string, orderId: string) {
  const result = await client.GET("/api/v1/checkout/orders/{orderId}", {
    headers: { Authorization: `Bearer ${token}` }, params: { path: { orderId } },
  });
  if (!result.data) throw new Error("No se pudo cargar la confirmación de tu compra.");
  return checkoutResultSchema.parse(result.data);
}
