import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthSession, CustomerOrderDetail } from "@technology-ecommerce/api-schemas";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "../src/features/auth/session";
import { OrdersPage } from "../src/features/orders/orders-page";
import { OrderDetailPage } from "../src/features/orders/order-detail";
import { OrdersApiError } from "../src/features/orders/orders-api";
import { SessionControls } from "../src/features/auth/session-controls";

const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), push: vi.fn(), replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }), useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock("../src/features/orders/orders-api", async (original) => ({ ...await original<object>(), getMyOrders: mocks.list, getMyOrder: mocks.detail }));

const session: AuthSession = {
  accessToken: "customer-token", accessTokenExpiresAt: "2026-09-09T23:00:00Z", sessionExpiresAt: "2026-09-16T23:00:00Z", tokenType: "Bearer",
  user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", displayName: "Nombre actual", email: "current@example.com", role: "CUSTOMER" },
};
const order: CustomerOrderDetail = {
  id: "16f7d829-e4c8-4a78-a883-4e21b2d8a957", number: "ORD-HISTORIC-1", status: "PROCESSING", currency: "USD",
  subtotal: "200.00", shippingTotal: "5.00", taxTotal: "0.00", total: "205.00",
  createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z", cancelledAt: null,
  customerSnapshot: { displayName: "Nombre histórico", email: "historic@example.com" },
  shippingAddressSnapshot: { recipientName: "Destinatario original", line1: "Calle Antigua 123", line2: "Depto 4", city: "Santiago", region: "RM", postalCode: "8320000", countryCode: "CL" },
  shippingMethodSnapshot: { method: "STANDARD", name: "Envío estándar histórico", cost: "5.00" },
  paymentSnapshot: { status: "APPROVED", method: "SIMULATED_CARD_APPROVED", providerReference: "SIM-ORIGINAL" },
  items: [{ productId: "6040fbbe-923e-4763-a6b9-a65d69536bf8", name: "Teclado histórico", sku: "TECH-OLD", quantity: 2, unitPrice: "100.00", lineTotal: "200.00", taxAmount: "0.00", currency: "USD" }],
};
function mount(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), client };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.search = "";
  useSessionStore.setState({ session, status: "authenticated", notice: null });
  mocks.list.mockResolvedValue({ items: [order], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
  mocks.detail.mockResolvedValue(order);
});

describe("customer purchases", () => {
  it("loads only the requested backend page and preserves status when navigating", async () => {
    mocks.search = "page=10&status=PROCESSING";
    mocks.list.mockResolvedValue({ items: [order], page: 10, pageSize: 20, totalItems: 500, totalPages: 25 });
    mount(<OrdersPage />);
    expect(await screen.findByText("ORD-HISTORIC-1")).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledWith("customer-token", { page: 10, pageSize: 20, status: "PROCESSING" }, expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "Página 10, actual" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Ver pedido ORD-HISTORIC-1" })).toHaveAttribute("href", `/account/orders/${order.id}`);
    await userEvent.click(screen.getByRole("button", { name: "Ir a la página siguiente" }));
    expect(mocks.push).toHaveBeenLastCalledWith("/account/orders?page=11&status=PROCESSING");
    await userEvent.selectOptions(screen.getByLabelText("Estado de la orden"), "CANCELLED");
    expect(mocks.push).toHaveBeenLastCalledWith("/account/orders?page=1&status=CANCELLED");
  });
  it("normalizes invalid URL criteria without sending arbitrary status or page", async () => {
    mocks.search = "page=-2&status=UNKNOWN";
    mount(<OrdersPage />);
    await screen.findByText(order.number);
    expect(mocks.list).toHaveBeenCalledWith("customer-token", { page: 1, pageSize: 20 }, expect.any(AbortSignal));
  });
  it("shows a useful empty state and handles out-of-range pages without invalid pagination", async () => {
    mocks.search = "page=99";
    mocks.list.mockResolvedValue({ items: [], page: 99, pageSize: 20, totalItems: 1, totalPages: 1 });
    mount(<OrdersPage />);
    expect(await screen.findByText("No hay compras en esta página")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Paginación" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a la primera página" }));
    expect(mocks.push).toHaveBeenCalledWith("/account/orders?page=1");
  });
  it("invites customers without purchases to explore products", async () => {
    mocks.list.mockResolvedValue({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    mount(<OrdersPage />);
    expect(await screen.findByText("Tu primera compra empieza en la tienda")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar productos" })).toHaveAttribute("href", "/");
  });
  it.each(["PROCESSING", "INVOICED", "COMPLETED", "CANCELLED"] as const)("renders %s independently from the original payment and uses historical data", async (status) => {
    mocks.detail.mockResolvedValue({ ...order, status, cancelledAt: status === "CANCELLED" ? "2026-09-09T12:00:00Z" : null });
    mount(<OrderDetailPage orderId={order.id} />);
    expect(await screen.findByText("Teclado histórico")).toBeInTheDocument();
    const label = { PROCESSING: "En proceso", INVOICED: "Facturada", COMPLETED: "Completada", CANCELLED: "Cancelada" }[status];
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Nombre histórico")).toBeInTheDocument();
    expect(screen.queryByText("Nombre actual")).not.toBeInTheDocument();
    expect(screen.getByText(/Calle Antigua 123/)).toBeInTheDocument();
    expect(screen.getByText("Envío estándar histórico")).toBeInTheDocument();
    expect(screen.getByText(/Aprobado · Tarjeta simulada/)).toBeInTheDocument();
    expect(screen.getByText(/SIM-ORIGINAL/)).toBeInTheDocument();
    expect(screen.getByText("$205.00")).toBeInTheDocument();
    expect(screen.getByText("2 × $100.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancelar|facturar/i })).not.toBeInTheDocument();
  });
  it("shows incomplete snapshots safely without dumping unknown fields", async () => {
    mocks.detail.mockResolvedValue({ ...order, paymentSnapshot: { secret: "HIDDEN", status: {} }, customerSnapshot: {}, shippingAddressSnapshot: {}, shippingMethodSnapshot: {} });
    mount(<OrderDetailPage orderId={order.id} />);
    await screen.findByText("Teclado histórico");
    expect(screen.getAllByText(/No registrado/).length).toBeGreaterThan(0);
    expect(screen.queryByText("HIDDEN")).not.toBeInTheDocument();
  });
  it("waits for restoration, redirects visitors to the exact destination, and never requests private data", async () => {
    useSessionStore.setState({ session: null, status: "initializing" });
    mount(<OrderDetailPage orderId={order.id} />);
    expect(screen.getByText("Validando acceso a tus compras…")).toBeInTheDocument();
    expect(mocks.detail).not.toHaveBeenCalled();
    act(() => useSessionStore.getState().clear());
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/login?returnTo=${encodeURIComponent(`/account/orders/${order.id}`)}`));
    expect(mocks.detail).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", "BILLING"] as const)("blocks %s from the customer UI and hides its history link", (role) => {
    useSessionStore.setState({ session: { ...session, user: { ...session.user, role } } });
    mount(<><OrdersPage /><SessionControls /></>);
    expect(screen.getByRole("heading", { name: "Área de clientes" })).toBeInTheDocument();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Mis compras" })).not.toBeInTheDocument();
  });
  it("offers retry for network errors and reloads successfully", async () => {
    mocks.detail.mockRejectedValueOnce(new Error("offline"));
    mount(<OrderDetailPage orderId={order.id} />);
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Teclado histórico")).toBeInTheDocument();
  });
  it.each([401, 403, 404])("handles HTTP %s without showing order data", async (status) => {
    mocks.detail.mockRejectedValue(new OrdersApiError(status));
    mount(<OrderDetailPage orderId={order.id} />);
    await screen.findByRole("alert");
    expect(screen.queryByText("Teclado histórico")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    if (status === 401) expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", `/login?returnTo=${encodeURIComponent(`/account/orders/${order.id}`)}`);
  });
  it("never displays another customer's cached detail after switching accounts", async () => {
    mount(<OrderDetailPage orderId={order.id} />);
    await screen.findByText("Teclado histórico");
    mocks.detail.mockRejectedValue(new OrdersApiError(404));
    act(() => useSessionStore.getState().setSession({ ...session, accessToken: "second-token", user: { ...session.user, id: "7b8233b7-3a9f-4e3f-9852-943711e8387a" } }));
    expect(screen.queryByText("Teclado histórico")).not.toBeInTheDocument();
    await screen.findByRole("alert");
    expect(mocks.detail).toHaveBeenLastCalledWith("second-token", order.id, expect.any(AbortSignal));
    expect(screen.queryByText("Teclado histórico")).not.toBeInTheDocument();
  });
  it("removes private data on logout and exposes the customer history entry", async () => {
    mount(<><OrderDetailPage orderId={order.id} /><SessionControls /></>);
    await screen.findByText("Teclado histórico");
    expect(screen.getAllByRole("link", { name: "Mis compras" }).length).toBeGreaterThan(0);
    act(() => useSessionStore.getState().clear());
    expect(screen.queryByText("Teclado histórico")).not.toBeInTheDocument();
  });
});
