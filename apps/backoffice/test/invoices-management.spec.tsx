import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { InvoiceDetailPage } from "../src/features/invoices/invoice-detail";
import { InvoicesManagement } from "../src/features/invoices/invoice-management";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: "" }));
const api = vi.hoisted(() => ({
  listInvoices: vi.fn(),
  createManualInvoice: vi.fn(),
  invoiceOrder: vi.fn(),
  changeInvoiceStatus: vi.fn(),
  getInvoice: vi.fn(),
  downloadInvoicePdf: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/invoices",
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock("../src/features/invoices/invoice-api", () => api);

const base = {
  id: "421d45a3-104e-4413-b79f-25290d1cb0a3",
  number: null,
  origin: "MANUAL" as const,
  status: "DRAFT" as const,
  orderId: null,
  customerId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
  createdByUserId: "746488d9-0de9-40ea-b346-a3e85ca2c28e",
  currency: "USD" as const,
  subtotal: "100.00",
  shippingTotal: "0.00",
  taxTotal: "0.00",
  total: "100.00",
  issuerSnapshot: {},
  customerSnapshot: { displayName: "Cliente histórico", email: "client@example.com" },
  createdAt: "2026-09-09T12:00:00Z",
  updatedAt: "2026-09-09T12:00:00Z",
  issuedAt: null,
  dueAt: null,
  paidAt: null,
  voidedAt: null,
};

const detail = { ...base, lines: [{ productId: null, position: 1, skuSnapshot: null, nameSnapshot: "Servicio", descriptionSnapshot: "Servicio", quantity: 1, unitPrice: "100.00", taxRate: "0.0000", taxAmount: "0.00", lineSubtotal: "100.00", lineTotal: "100.00", currency: "USD" as const }] };

function session(role: "ADMIN" | "BILLING" | "CUSTOMER" = "ADMIN") {
  useSessionStore.setState({ notice: null, status: "authenticated", session: { accessToken: `${role}-token`, accessTokenExpiresAt: "2026-09-10T14:00:00Z", sessionExpiresAt: "2026-09-17T12:00:00Z", tokenType: "Bearer", user: { id: "746488d9-0de9-40ea-b346-a3e85ca2c28e", displayName: role, email: `${role.toLowerCase()}@example.com`, role } } });
}

function mount(ui: React.ReactNode = <InvoicesManagement />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.search = "";
  session();
  api.listInvoices.mockResolvedValue({ items: [base], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
  api.createManualInvoice.mockResolvedValue(detail);
  api.invoiceOrder.mockResolvedValue({ ...detail, origin: "ORDER", number: "INV-ORDER" });
  api.changeInvoiceStatus.mockResolvedValue({ ...detail, status: "PENDING_PAYMENT", number: "INV-001", issuedAt: "2026-09-10T12:00:00Z" });
  api.getInvoice.mockResolvedValue(detail);
  api.downloadInvoicePdf.mockResolvedValue({ blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }), filename: "invoice-001.pdf" });
});

describe("backoffice invoice management", () => {
  it("loads the paginated list, navigates filters and exposes manual form validation", async () => {
    mount();
    expect(await screen.findByText("Borrador sin número")).toBeInTheDocument();
    expect(api.listInvoices).toHaveBeenCalledWith("ADMIN-token", expect.objectContaining({ page: 1, sortBy: "createdAt" }), expect.any(AbortSignal));
    fireEvent.change(screen.getByPlaceholderText("Número o cliente histórico"), { target: { value: "INV-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(navigation.push).toHaveBeenLastCalledWith(expect.stringContaining("page=1&search=INV-123"), { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Nueva factura manual" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear factura manual" }));
    expect(await screen.findByText("Debe ser un UUID de cliente válido.")).toBeInTheDocument();
  });

  it("submits a validated manual invoice and keeps Billing actions available", async () => {
    session("BILLING");
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Nueva factura manual" }));
    fireEvent.change(screen.getByLabelText("ID del cliente"), { target: { value: base.customerId } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Servicio" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Servicio técnico" } });
    fireEvent.change(screen.getByLabelText("Precio unitario (USD)"), { target: { value: "100.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear factura manual" }));
    await waitFor(() => expect(api.createManualInvoice).toHaveBeenCalledWith("BILLING-token", expect.objectContaining({ customerId: base.customerId, lines: [expect.objectContaining({ name: "Servicio", unitPrice: "100.00" })] })));
    expect(await screen.findByText("Factura manual creada como borrador.")).toBeInTheDocument();
    const row = screen.getByText("Borrador sin número").closest("tr");
    expect(row).toBeTruthy();
    expect(within(row!).getByRole("button", { name: "Emitir" })).toBeInTheDocument();
  });

  it("converts an eligible order from the Billing workspace", async () => {
    session("BILLING");
    mount();
    const orderId = "6040fbbe-923e-4763-a6b9-a65d69536bf8";
    fireEvent.change(screen.getByPlaceholderText("UUID de orden a facturar"), { target: { value: orderId } });
    fireEvent.click(screen.getByRole("button", { name: "Facturar orden" }));
    await waitFor(() => expect(api.invoiceOrder).toHaveBeenCalledWith("BILLING-token", orderId));
    expect(await screen.findByText(/Orden convertida en factura/)).toBeInTheDocument();
  });

  it("downloads an authorized invoice PDF", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:admin-invoice") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    mount(<InvoiceDetailPage invoiceId={base.id} />);
    await screen.findByText("Servicio");
    await userEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(api.downloadInvoicePdf).toHaveBeenCalledWith("ADMIN-token", base.id));
    expect(screen.getByRole("status")).toHaveTextContent("PDF descargado correctamente.");
    expect(click).toHaveBeenCalled();
  });

});
