import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthSession, InvoicePage, InvoiceResponse } from "@technology-ecommerce/api-schemas";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { InvoiceDetailPage } from "../src/features/invoices/invoice-detail";
import { InvoicesPage } from "../src/features/invoices/invoices-page";
import { CustomerInvoicesApiError } from "../src/features/invoices/invoice-api";

const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), download: vi.fn(), push: vi.fn(), replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }), useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock("../src/features/invoices/invoice-api", async (original) => ({ ...await original<object>(), getMyInvoices: mocks.list, getMyInvoice: mocks.detail, downloadMyInvoicePdf: mocks.download }));

const session: AuthSession = {
  accessToken: "customer-token", accessTokenExpiresAt: "2026-09-09T23:00:00Z", sessionExpiresAt: "2026-09-16T23:00:00Z", tokenType: "Bearer",
  user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", displayName: "Cliente actual", email: "current@example.com", role: "CUSTOMER" },
};
const invoice: InvoiceResponse = {
  id: "16f7d829-e4c8-4a78-a883-4e21b2d8a957", number: "INV-CUSTOMER-1", origin: "ORDER", status: "PAID", orderId: "7c4f5a98-1f31-4e74-a848-d6e454d8b2a2", customerId: session.user.id, createdByUserId: null, currency: "USD",
  subtotal: "200.00", shippingTotal: "5.00", taxTotal: "0.00", total: "205.00", issuerSnapshot: { legalName: "Tienda histórica" }, customerSnapshot: { displayName: "Cliente histórico", email: "historic@example.com" },
  createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z", issuedAt: "2026-09-01T12:01:00Z", dueAt: null, paidAt: "2026-09-01T12:02:00Z", voidedAt: null,
  lines: [{ productId: "6040fbbe-923e-4763-a6b9-a65d69536bf8", position: 1, skuSnapshot: "TECH-OLD", nameSnapshot: "Teclado histórico", descriptionSnapshot: "Descripción histórica", quantity: 2, unitPrice: "100.00", taxRate: "0.0000", taxAmount: "0.00", lineSubtotal: "200.00", lineTotal: "200.00", currency: "USD" }],
};
const page: InvoicePage = { items: [invoice], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };

function mount(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = "";
  useSessionStore.setState({ session, status: "authenticated", notice: null });
  mocks.list.mockResolvedValue(page);
  mocks.detail.mockResolvedValue(invoice);
  mocks.download.mockResolvedValue({ blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }), filename: `invoice-${invoice.id}.pdf` });
});

describe("customer invoices", () => {
  it("loads only the authenticated customer's paginated invoices and preserves page navigation", async () => {
    mocks.search = "page=2";
    mocks.list.mockResolvedValue({ ...page, page: 2, totalItems: 41, totalPages: 3 });
    mount(<InvoicesPage />);
    expect(await screen.findByText("INV-CUSTOMER-1")).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith("customer-token", { page: 2, pageSize: 20 }, expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "Página 2, actual" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ir a la página siguiente" }));
    expect(mocks.push).toHaveBeenCalledWith("/account/invoices?page=3");
  });

  it("renders historical detail without exposing administrative actions", async () => {
    mount(<InvoiceDetailPage invoiceId={invoice.id} />);
    expect(await screen.findByText("Teclado histórico")).toBeInTheDocument();
    expect(screen.getByText("Cliente histórico")).toBeInTheDocument();
    expect(screen.getByText("$205.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /emitir|pagada|anular/i })).not.toBeInTheDocument();
    expect(mocks.detail).toHaveBeenCalledWith("customer-token", invoice.id, expect.any(AbortSignal));
  });

  it("downloads the customer's invoice PDF and reports failures", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:invoice") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    mount(<InvoiceDetailPage invoiceId={invoice.id} />);
    await screen.findByText("Teclado histórico");
    await userEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith("customer-token", invoice.id));
    expect(screen.getByRole("status")).toHaveTextContent("PDF descargado correctamente.");
    expect(click).toHaveBeenCalled();
    mocks.download.mockRejectedValueOnce(new CustomerInvoicesApiError(500));
    await userEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar tus facturas");
  });

  it("does not display invoice data after switching to another customer", async () => {
    mount(<InvoiceDetailPage invoiceId={invoice.id} />);
    await screen.findByText("Teclado histórico");
    mocks.detail.mockRejectedValue(new CustomerInvoicesApiError(404));
    act(() => useSessionStore.getState().setSession({ ...session, accessToken: "second-token", user: { ...session.user, id: "7b8233b7-3a9f-4e3f-9852-943711e8387a" } }));
    expect(screen.queryByText("Teclado histórico")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.detail).toHaveBeenLastCalledWith("second-token", invoice.id, expect.any(AbortSignal)));
    expect(await screen.findByRole("alert")).toHaveTextContent("No encontramos esta factura en tu cuenta.");
    expect(screen.queryByText("Cliente histórico")).not.toBeInTheDocument();
  });

  it("shows a safe empty state when the customer has no invoices", async () => {
    mocks.list.mockResolvedValue({ ...page, items: [], totalItems: 0, totalPages: 0 });
    mount(<InvoicesPage />);
    expect(await screen.findByText("Aún no tienes facturas")).toBeInTheDocument();
  });

  it.each(["ADMIN", "BILLING"] as const)("blocks %s from the customer invoice area", (role) => {
    useSessionStore.setState({ session: { ...session, user: { ...session.user, role } }, status: "authenticated" });
    mount(<InvoicesPage />);
    expect(screen.getByRole("heading", { name: "Área de clientes" })).toBeInTheDocument();
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
