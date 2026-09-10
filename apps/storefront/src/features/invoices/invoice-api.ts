import { createApiClient, createPdfDownload, type PdfDownload } from "@technology-ecommerce/api-client";
import {
  invoicePageSchema,
  invoiceResponseSchema,
  type InvoicePage,
  type InvoiceResponse,
} from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export type CustomerInvoiceFilters = Readonly<{
  page: number;
  pageSize: number;
}>;

export class CustomerInvoicesApiError extends Error {
  constructor(readonly status: number) {
    super(
      status === 401
        ? "Tu sesión venció. Inicia sesión para consultar tus facturas."
        : status === 403
          ? "Esta sección está disponible solo para clientes."
          : status === 404
            ? "No encontramos esta factura en tu cuenta."
            : "No se pudieron cargar tus facturas. Inténtalo nuevamente.",
    );
    this.name = "CustomerInvoicesApiError";
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

export async function getMyInvoices(
  token: string,
  filters: CustomerInvoiceFilters,
  signal?: AbortSignal,
): Promise<InvoicePage> {
  const result = await client.GET("/api/v1/invoices", {
    ...requestOptions(token, signal),
    params: {
      query: {
        page: filters.page,
        pageSize: filters.pageSize,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    },
  });
  if (!result.data) throw new CustomerInvoicesApiError(result.response.status);
  return invoicePageSchema.parse(result.data);
}

export async function getMyInvoice(
  token: string,
  invoiceId: string,
  signal?: AbortSignal,
): Promise<InvoiceResponse> {
  const result = await client.GET("/api/v1/invoices/{invoiceId}", {
    ...requestOptions(token, signal),
    params: { path: { invoiceId } },
  });
  if (!result.data) throw new CustomerInvoicesApiError(result.response.status);
  return invoiceResponseSchema.parse(result.data);
}

export async function downloadMyInvoicePdf(token: string, invoiceId: string): Promise<PdfDownload> {
  const result = await client.GET("/api/v1/invoices/{invoiceId}/pdf", {
    ...requestOptions(token),
    parseAs: "blob",
    params: { path: { invoiceId } },
  });
  if (!result.data) throw new CustomerInvoicesApiError(result.response.status);
  try {
    return createPdfDownload(result.response, result.data, `invoice-${invoiceId}.pdf`);
  } catch {
    throw new CustomerInvoicesApiError(502);
  }
}
