import { createApiClient, createPdfDownload, type PdfDownload } from "@technology-ecommerce/api-client";
import {
  administrativeOrderPageSchema,
  cancelOrderRequestSchema,
  cancelledOrderSchema,
  cartOperationErrorSchema,
  customerOrderDetailSchema,
  customerOrderSummarySchema,
  type AdministrativeOrderPage,
  type CancelOrderRequest,
  type CustomerOrderDetail,
} from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export type AdministrativeOrderFilters = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  customerId?: string;
  status?: CustomerOrderDetail["status"];
  createdFrom?: string;
  createdTo?: string;
  invoicing?: "ACTIVE_INVOICE" | "NO_ACTIVE_INVOICE";
  sortBy: "createdAt" | "number" | "total" | "status";
  sortOrder: "asc" | "desc";
}>;

const messages: Record<string, string> = {
  ORDER_ACTIVE_INVOICE: "Anula primero la factura activa antes de cancelar esta orden.",
  ORDER_INVALID_TRANSITION: "El estado actual de la orden no permite esta operación.",
  ORDER_DEDICATED_WORKFLOW_REQUIRED: "Esta transición requiere su flujo específico.",
  ORDER_RESTOCK_OVERFLOW: "No fue posible restituir el inventario de esta orden.",
  REQUEST_VALIDATION_FAILED: "Revisa los datos enviados.",
};

export class OrderApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(status === 401 ? "Tu sesión venció. Inicia sesión nuevamente."
      : status === 403 ? "Tu rol no permite realizar esta operación."
        : status === 404 ? "No encontramos la orden solicitada."
          : messages[code ?? ""] ?? "No pudimos completar la operación. Inténtalo nuevamente.");
    this.name = "OrderApiError";
  }
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function apiDate(value: string | undefined, endOfDay = false): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`).toISOString();
}

function failure(result: { error?: unknown; response: Response }): OrderApiError {
  const parsed = cartOperationErrorSchema.safeParse(result.error);
  return new OrderApiError(result.response.status, parsed.success ? parsed.data.code : undefined);
}

export async function listOrders(accessToken: string, filters: AdministrativeOrderFilters, signal?: AbortSignal): Promise<AdministrativeOrderPage> {
  const result = await client.GET("/api/v1/orders", {
    headers: authorization(accessToken), signal,
    params: { query: {
      ...filters,
      createdFrom: apiDate(filters.createdFrom),
      createdTo: apiDate(filters.createdTo, true),
    } },
  });
  if (!result.data) throw failure(result);
  return administrativeOrderPageSchema.parse(result.data);
}

export async function getOrder(accessToken: string, orderId: string, signal?: AbortSignal) {
  const result = await client.GET("/api/v1/orders/{orderId}", {
    headers: authorization(accessToken), params: { path: { orderId } }, signal,
  });
  if (!result.data) throw failure(result);
  return customerOrderDetailSchema.parse(result.data);
}

export async function downloadOrderPdf(accessToken: string, orderId: string): Promise<PdfDownload> {
  const result = await client.GET("/api/v1/orders/{orderId}/pdf", {
    headers: authorization(accessToken),
    parseAs: "blob",
    params: { path: { orderId } },
  });
  if (!result.data) throw failure(result);
  try {
    return createPdfDownload(result.response, result.data, `order-${orderId}.pdf`);
  } catch {
    throw new OrderApiError(502);
  }
}

export async function completeOrder(accessToken: string, orderId: string) {
  const result = await client.PATCH("/api/v1/orders/{orderId}/status", {
    body: { status: "COMPLETED" }, headers: authorization(accessToken), params: { path: { orderId } },
  });
  if (!result.data) throw failure(result);
  return customerOrderSummarySchema.parse(result.data);
}

export async function cancelOrder(accessToken: string, orderId: string, input: CancelOrderRequest) {
  const result = await client.POST("/api/v1/orders/{orderId}/cancel", {
    body: cancelOrderRequestSchema.parse(input), headers: authorization(accessToken), params: { path: { orderId } },
  });
  if (!result.data) throw failure(result);
  return cancelledOrderSchema.parse(result.data);
}
