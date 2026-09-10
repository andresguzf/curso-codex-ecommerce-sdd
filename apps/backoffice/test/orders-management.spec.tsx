import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "../src/features/auth/session";
import { OrdersManagementPage } from "../src/features/orders/orders-management";
import { AdministrativeOrderDetailPage } from "../src/features/orders/order-detail";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: "" }));
const api = vi.hoisted(() => ({ listOrders: vi.fn(), getOrder: vi.fn(), downloadOrderPdf: vi.fn(), cancelOrder: vi.fn(), completeOrder: vi.fn() }));
const billingApi = vi.hoisted(() => ({ invoiceOrder: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/orders", useRouter: () => navigation, useSearchParams: () => new URLSearchParams(navigation.search) }));
vi.mock("../src/features/orders/order-api", () => api);
vi.mock("../src/features/invoices/invoice-api", async (original) => ({ ...await original<object>(), invoiceOrder: billingApi.invoiceOrder }));

const base = {
  id: "421d45a3-104e-4413-b79f-25290d1cb0a3", number: "ORD-001", status: "PROCESSING" as const, currency: "USD" as const,
  subtotal: "100.00", shippingTotal: "5.00", taxTotal: "0.00", total: "105.00", createdAt: "2026-09-09T12:00:00Z", updatedAt: "2026-09-09T12:00:00Z", cancelledAt: null,
  customerId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", customerSnapshot: { displayName: "Cliente histórico", email: "historic@example.com" },
};
const invoiced = { ...base, id: "6040fbbe-923e-4763-a6b9-a65d69536bf8", number: "ORD-002", status: "INVOICED" as const };
const detail = { ...base, shippingAddressSnapshot: { recipientName: "Comprador", line1: "Calle 123", city: "Santiago" }, shippingMethodSnapshot: { name: "Envío histórico" }, paymentSnapshot: { status: "APPROVED", providerReference: "SIM-001" }, items: [{ productId: invoiced.id, sku: "TECH-1", name: "Teclado histórico", quantity: 1, unitPrice: "100.00", taxAmount: "0.00", lineTotal: "100.00", currency: "USD" as const }] };
function session(role: "ADMIN" | "BILLING" | "CUSTOMER" = "ADMIN") { useSessionStore.setState({ notice: null, status: "authenticated", session: { accessToken: `${role}-token`, accessTokenExpiresAt: "2026-09-10T14:00:00Z", sessionExpiresAt: "2026-09-17T12:00:00Z", tokenType: "Bearer", user: { id: "746488d9-0de9-40ea-b346-a3e85ca2c28e", displayName: role, email: `${role.toLowerCase()}@example.com`, role } } }); }
function mount(ui: React.ReactNode) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); const invalidate = vi.spyOn(client, "invalidateQueries"); render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>); return invalidate; }

beforeEach(() => {
  vi.clearAllMocks(); navigation.search = ""; session();
  api.listOrders.mockResolvedValue({ items: [base, invoiced], page: 1, pageSize: 20, totalItems: 2, totalPages: 1 }); api.getOrder.mockResolvedValue(detail);
  api.cancelOrder.mockResolvedValue({ ...base, status: "CANCELLED", cancelledAt: "2026-09-10T12:00:00Z" }); api.completeOrder.mockResolvedValue({ ...invoiced, status: "COMPLETED" });
  api.downloadOrderPdf.mockResolvedValue({ blob: new Blob(["%PDF-1.4"], { type: "application/pdf" }), filename: "order-001.pdf" });
  billingApi.invoiceOrder.mockResolvedValue({ number: "INV-001" });
});

describe("backoffice order management", () => {
  it("requests the URL criteria and keeps search, filters and sorting in navigation", async () => {
    navigation.search = "page=4&search=cliente&status=PROCESSING&invoicing=NO_ACTIVE_INVOICE&sortBy=total&sortOrder=asc";
    api.listOrders.mockResolvedValue({ items: [base], page: 4, pageSize: 20, totalItems: 100, totalPages: 5 }); mount(<OrdersManagementPage />);
    expect(await screen.findByText("ORD-001")).toBeInTheDocument();
    expect(api.listOrders).toHaveBeenCalledWith("ADMIN-token", expect.objectContaining({ page: 4, search: "cliente", status: "PROCESSING", invoicing: "NO_ACTIVE_INVOICE", sortBy: "total", sortOrder: "asc" }), expect.any(AbortSignal));
    fireEvent.change(screen.getByPlaceholderText("Número, nombre o correo del cliente"), { target: { value: "ORD-009" } }); fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(navigation.push).toHaveBeenLastCalledWith(expect.stringContaining("page=1&search=ORD-009"), { scroll: false });
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "CANCELLED" } }); fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-09-01" } }); fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-30" } }); fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(navigation.push).toHaveBeenLastCalledWith(expect.stringMatching(/page=1.*status=CANCELLED.*createdFrom=2026-09-01.*createdTo=2026-09-30/), { scroll: false });
  });
  it("validates dates and customer UUID before navigation", async () => {
    mount(<OrdersManagementPage />); await screen.findByText("ORD-001");
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-01" } }); fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-01" } }); fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.getByText("La fecha inicial no puede ser posterior a la fecha final.")).toBeInTheDocument(); expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "" } }); fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "" } }); fireEvent.change(screen.getByLabelText("ID de cliente"), { target: { value: "not-a-uuid" } }); fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.getByText("El identificador del cliente debe ser un UUID válido.")).toBeInTheDocument();
  });
  it("shows Admin actions by state, confirms completion and validates cancellation reason", async () => {
    const invalidate = mount(<OrdersManagementPage />); await screen.findByText("ORD-001");
    const processingRow = screen.getByText("ORD-001").closest("tr")!; const invoicedRow = screen.getByText("ORD-002").closest("tr")!;
    expect(within(processingRow).queryByRole("button", { name: "Completar" })).not.toBeInTheDocument(); expect(within(processingRow).getByRole("button", { name: "Facturar orden" })).toBeInTheDocument(); expect(within(processingRow).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    fireEvent.click(within(invoicedRow).getByRole("button", { name: "Completar" })); fireEvent.click(within(screen.getByRole("dialog", { name: "¿Completar esta orden?" })).getByRole("button", { name: "Completar orden" }));
    await waitFor(() => expect(api.completeOrder).toHaveBeenCalledWith("ADMIN-token", invoiced.id)); expect(await screen.findByText("Orden completada correctamente.")).toBeInTheDocument();
    fireEvent.click(within(processingRow).getByRole("button", { name: "Cancelar" })); const dialog = screen.getByRole("dialog", { name: "Cancelar orden" }); fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cancelación" })); expect(await within(dialog).findByText("Escribe un motivo de 1 a 500 caracteres.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Motivo de cancelación"), { target: { value: "Solicitud del cliente" } }); fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cancelación" }));
    await waitFor(() => expect(api.cancelOrder).toHaveBeenCalledWith("ADMIN-token", base.id, { reason: "Solicitud del cliente" })); expect(await screen.findByText("Orden cancelada y stock restituido correctamente.")).toBeInTheDocument(); expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "orders"] });
  });
  it("lets Billing complete and cancel orders according to their state", async () => {
    session("BILLING"); mount(<OrdersManagementPage />); await screen.findByText("ORD-001");
    const processingRow = screen.getByText("ORD-001").closest("tr")!; const invoicedRow = screen.getByText("ORD-002").closest("tr")!;
    expect(within(processingRow).queryByRole("button", { name: "Completar" })).not.toBeInTheDocument(); expect(within(processingRow).getByRole("button", { name: "Facturar orden" })).toBeInTheDocument(); expect(within(processingRow).getByRole("button", { name: "Cancelar" })).toBeInTheDocument(); expect(within(invoicedRow).getByRole("button", { name: "Completar" })).toBeInTheDocument(); expect(within(invoicedRow).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    fireEvent.click(within(invoicedRow).getByRole("button", { name: "Completar" })); fireEvent.click(within(screen.getByRole("dialog", { name: "¿Completar esta orden?" })).getByRole("button", { name: "Completar orden" }));
    await waitFor(() => expect(api.completeOrder).toHaveBeenCalledWith("BILLING-token", invoiced.id)); expect(api.listOrders).toHaveBeenCalledWith("BILLING-token", expect.anything(), expect.any(AbortSignal));
  });
  it.each(["ADMIN", "BILLING"] as const)("allows %s to convert a processing order into an invoice", async (role) => {
    session(role); mount(<OrdersManagementPage />); await screen.findByText("ORD-001");
    const processingRow = screen.getByText("ORD-001").closest("tr")!;
    fireEvent.click(within(processingRow).getByRole("button", { name: "Facturar orden" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "¿Convertir esta orden en factura?" })).getByRole("button", { name: "Facturar orden" }));
    await waitFor(() => expect(billingApi.invoiceOrder).toHaveBeenCalledWith(`${role}-token`, base.id));
    expect(await screen.findByText(/Orden convertida en factura/)).toBeInTheDocument();
  });
  it("renders immutable historical detail and eligible order actions for Billing", async () => {
    session("BILLING"); mount(<AdministrativeOrderDetailPage orderId={base.id} />);
    expect(await screen.findByText("Teclado histórico")).toBeInTheDocument(); expect(screen.getAllByText("Cliente histórico")).toHaveLength(2); expect(screen.getByText("Aprobado")).toBeInTheDocument(); expect(screen.getAllByText("Envío histórico")).toHaveLength(2); expect(screen.getByText(/Orden pendiente de facturación/)).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Facturar orden" })).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Completar" })).not.toBeInTheDocument(); expect(screen.getByText(/snapshot de la orden/)).toBeInTheDocument();
  });
  it.each(["ADMIN", "BILLING"] as const)("allows %s to convert the order from its detail view", async (role) => {
    session(role); mount(<AdministrativeOrderDetailPage orderId={base.id} />);
    await screen.findByText("Teclado histórico");
    fireEvent.click(screen.getByRole("button", { name: "Facturar orden" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "¿Convertir esta orden en factura?" })).getByRole("button", { name: "Facturar orden" }));
    await waitFor(() => expect(billingApi.invoiceOrder).toHaveBeenCalledWith(`${role}-token`, base.id));
    expect(await screen.findByText(/Orden convertida en factura/)).toBeInTheDocument();
  });
  it("downloads an authorized order PDF and surfaces API errors", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:admin-order") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    mount(<AdministrativeOrderDetailPage orderId={base.id} />);
    await screen.findByText("Teclado histórico");
    await userEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(api.downloadOrderPdf).toHaveBeenCalledWith("ADMIN-token", base.id));
    expect(screen.getByRole("status")).toHaveTextContent("PDF descargado correctamente.");
    expect(click).toHaveBeenCalled();
  });
  it("does not request orders before authentication and redirects anonymous users", async () => {
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" }); mount(<OrdersManagementPage />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login")); expect(api.listOrders).not.toHaveBeenCalled();
  });
  it("shows API errors and retries the authoritative list", async () => {
    api.listOrders.mockRejectedValueOnce(new Error("Sin conexión")); mount(<OrdersManagementPage />);
    expect(await screen.findByText("Sin conexión")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); expect(await screen.findByText("ORD-001")).toBeInTheDocument();
  });
});
