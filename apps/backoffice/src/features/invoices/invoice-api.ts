import { createApiClient } from "@technology-ecommerce/api-client";
import {
  createManualInvoiceRequestSchema,
  invoicePageSchema,
  invoiceResponseSchema,
  invoiceStatusRequestSchema,
  type CreateManualInvoiceRequest,
  type InvoicePage,
  type InvoiceResponse,
  type InvoiceStatusRequest,
} from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export type InvoiceFilters = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  customerId?: string;
  status?: InvoiceStatusRequest["status"];
  origin?: "MANUAL" | "ORDER";
  createdFrom?: string;
  createdTo?: string;
  sortBy: "createdAt" | "number" | "total" | "status" | "origin";
  sortOrder: "asc" | "desc";
}>;

const messages: Record<string, string> = {
  INVOICE_INVALID_TRANSITION: "La factura no admite esa transición de estado.",
  INVOICE_NOT_FOUND: "No encontramos la factura solicitada.",
  ORDER_ACTIVE_INVOICE: "La orden ya tiene una factura activa.",
  ORDER_INVALID_TRANSITION: "La orden no está lista para facturarse.",
  REQUEST_VALIDATION_FAILED: "Revisa los datos enviados.",
};

export class InvoiceApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(
      status === 401
        ? "Tu sesión venció. Inicia sesión nuevamente."
        : status === 403
          ? "Tu rol no permite realizar esta operación."
          : status === 404
            ? "No encontramos el recurso solicitado."
            : messages[code ?? ""] ?? "No pudimos completar la operación. Inténtalo nuevamente.",
    );
    this.name = "InvoiceApiError";
  }
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function apiDate(value: string | undefined, endOfDay = false): string | undefined {
  if (!value) return undefined;
  return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`).toISOString();
}

function failure(result: { error?: unknown; response: Response }): InvoiceApiError {
  const body = result.error as { code?: unknown } | undefined;
  return new InvoiceApiError(result.response.status, typeof body?.code === "string" ? body.code : undefined);
}

export async function listInvoices(
  accessToken: string,
  filters: InvoiceFilters,
  signal?: AbortSignal,
): Promise<InvoicePage> {
  const result = await client.GET("/api/v1/invoices", {
    headers: authorization(accessToken),
    signal,
    params: {
      query: {
        ...filters,
        createdFrom: apiDate(filters.createdFrom),
        createdTo: apiDate(filters.createdTo, true),
      },
    },
  });
  if (!result.data) throw failure(result);
  return invoicePageSchema.parse(result.data);
}

export async function getInvoice(
  accessToken: string,
  invoiceId: string,
  signal?: AbortSignal,
): Promise<InvoiceResponse> {
  const result = await client.GET("/api/v1/invoices/{invoiceId}", {
    headers: authorization(accessToken),
    params: { path: { invoiceId } },
    signal,
  });
  if (!result.data) throw failure(result);
  return invoiceResponseSchema.parse(result.data);
}

export async function createManualInvoice(
  accessToken: string,
  input: CreateManualInvoiceRequest,
): Promise<InvoiceResponse> {
  const result = await client.POST("/api/v1/invoices", {
    body: createManualInvoiceRequestSchema.parse(input),
    headers: authorization(accessToken),
  });
  if (!result.data) throw failure(result);
  return invoiceResponseSchema.parse(result.data);
}

export async function changeInvoiceStatus(
  accessToken: string,
  invoiceId: string,
  input: InvoiceStatusRequest,
): Promise<InvoiceResponse> {
  const result = await client.PATCH("/api/v1/invoices/{invoiceId}/status", {
    body: invoiceStatusRequestSchema.parse(input),
    headers: authorization(accessToken),
    params: { path: { invoiceId } },
  });
  if (!result.data) throw failure(result);
  return invoiceResponseSchema.parse(result.data);
}

export async function invoiceOrder(
  accessToken: string,
  orderId: string,
): Promise<InvoiceResponse> {
  const result = await client.POST("/api/v1/orders/{orderId}/invoice", {
    headers: authorization(accessToken),
    params: { path: { orderId } },
  });
  if (!result.data) throw failure(result);
  return invoiceResponseSchema.parse(result.data);
}
