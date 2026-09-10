import { createApiClient, createPdfDownload, type PdfDownload } from "@technology-ecommerce/api-client";
import { customerOrderDetailSchema, customerOrderPageSchema, type CustomerOrderDetail } from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export type OrderFilters = { page: number; pageSize: number; status?: CustomerOrderDetail["status"] };

export class OrdersApiError extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? "Tu sesión venció. Inicia sesión para consultar tus compras."
      : status === 404 ? "No encontramos esta compra en tu cuenta."
        : status === 403 ? "Esta sección está disponible solo para clientes."
          : "No se pudieron cargar tus compras. Inténtalo nuevamente.");
    this.name = "OrdersApiError";
  }
}

function requestOptions(token: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(10_000);
  return {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store" as const,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  };
}

export async function getMyOrders(token: string, filters: OrderFilters, signal?: AbortSignal) {
  const result = await client.GET("/api/v1/orders/mine", {
    ...requestOptions(token, signal), params: { query: filters },
  });
  if (!result.data) throw new OrdersApiError(result.response.status);
  return customerOrderPageSchema.parse(result.data);
}

export async function getMyOrder(token: string, orderId: string, signal?: AbortSignal) {
  const result = await client.GET("/api/v1/orders/{orderId}", {
    ...requestOptions(token, signal), params: { path: { orderId } },
  });
  if (!result.data) throw new OrdersApiError(result.response.status);
  return customerOrderDetailSchema.parse(result.data);
}

export async function downloadMyOrderPdf(token: string, orderId: string): Promise<PdfDownload> {
  const result = await client.GET("/api/v1/orders/{orderId}/pdf", {
    ...requestOptions(token),
    parseAs: "blob",
    params: { path: { orderId } },
  });
  if (!result.data) throw new OrdersApiError(result.response.status);
  try {
    return createPdfDownload(result.response, result.data, `order-${orderId}.pdf`);
  } catch {
    throw new OrdersApiError(502);
  }
}
