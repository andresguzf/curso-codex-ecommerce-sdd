import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AuthSession, DashboardSummary } from "@technology-ecommerce/api-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "../src/app/page";
import { useSessionStore } from "../src/features/auth/session";
import { DashboardApiError } from "../src/features/dashboard/dashboard-api";

const api = vi.hoisted(() => ({ getDashboardSummary: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("../src/features/dashboard/dashboard-api", async (original) => ({
  ...await original<typeof import("../src/features/dashboard/dashboard-api")>(), getDashboardSummary: api.getDashboardSummary,
}));
const updatedAt = "2026-09-30T12:00:00.000Z";
const admin: DashboardSummary = { role: "ADMIN", updatedAt, lowStockThreshold: 5,
  metrics: { totalCustomers: 21, activeProducts: 18, lowStockProducts: 4, processingOrders: 3, pendingInvoices: 2 } };
const billing: DashboardSummary = { role: "BILLING", updatedAt,
  period: { from: "2026-08-31T12:00:00.000Z", to: updatedAt, basis: "paidAt" },
  metrics: { ordersAwaitingInvoice: 3, ordersEligibleForInvoicing: 2, pendingInvoices: 1, paidInvoices: 7 } };
function session(role: AuthSession["user"]["role"], id = "account-1"): AuthSession {
  return { accessToken: role + "-token", accessTokenExpiresAt: "2030-09-30T12:00:00Z", sessionExpiresAt: "2030-10-01T12:00:00Z", tokenType: "Bearer",
    user: { id, role, displayName: "Operador", email: "test@example.com" } };
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><HomePage /></QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore.setState({ status: "authenticated", session: session("ADMIN") });
  api.getDashboardSummary.mockResolvedValue(admin);
});
describe("authorized initial dashboard", () => {
  it("shows actual Admin counts and supported filtered links from one aggregate call", async () => {
    mount();
    expect(await screen.findByText("21", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("18", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Stock bajo o agotado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar clientes" })).toHaveAttribute("href", "/users?page=1&role=CUSTOMER");
    expect(screen.getByRole("link", { name: "Consultar productos activos" })).toHaveAttribute("href", "/products?page=1&status=ACTIVE");
    expect(screen.getByRole("link", { name: "Revisar inventario" })).toHaveAttribute("href", "/inventory?page=1&status=ACTIVE&sortBy=availableQuantity&sortOrder=asc");
    expect(screen.getByRole("link", { name: "Consultar órdenes en proceso" })).toHaveAttribute("href", "/orders?page=1&status=PROCESSING");
    expect(screen.getByRole("link", { name: "Consultar facturas pendientes" })).toHaveAttribute("href", "/invoices?page=1&status=PENDING_PAYMENT");
    expect(document.querySelector("time")).toHaveAttribute("dateTime", updatedAt);
    expect(api.getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(api.getDashboardSummary).toHaveBeenCalledWith("ADMIN-token", "ADMIN", expect.any(AbortSignal));
  });
  it("restricts Billing to orders and invoices, with visible paid period", async () => {
    useSessionStore.setState({ session: session("BILLING") });
    api.getDashboardSummary.mockResolvedValue(billing);
    mount();
    expect(await screen.findByText("7", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Órdenes elegibles para facturar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar órdenes por facturar" })).toHaveAttribute("href", "/orders?page=1&status=PROCESSING&invoicing=NO_ACTIVE_INVOICE");
    expect(screen.getByRole("link", { name: "Consultar facturas pagadas" })).toHaveAttribute("href", "/invoices?page=1&status=PAID");
    expect(document.querySelectorAll("time")).toHaveLength(3);
    for (const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).toMatch(/^\/(orders|invoices)/);
    for (const label of ["Clientes", "Productos activos", "Stock bajo o agotado", "Gestionar usuarios"]) expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
  it("shows loading without invented metrics or enabled refresh", () => {
    api.getDashboardSummary.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando indicadores");
    expect(screen.getByRole("button", { name: "Actualizando…" })).toBeDisabled();
    expect(document.querySelector("dd")).toBeNull();
  });
  it("preserves zero counts and supplies empty-state direction", async () => {
    api.getDashboardSummary.mockResolvedValue({ ...admin, metrics: { totalCustomers: 0, activeProducts: 0, lowStockProducts: 0, processingOrders: 0, pendingInvoices: 0 } });
    mount();
    expect(await screen.findByText(/Todavía no hay actividad/)).toBeInTheDocument();
    expect(screen.getAllByText("0", { selector: "dd" })).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Gestionar catálogo" })).toBeInTheDocument();
  });
  it("offers retry after a safe error and manual refresh updates all counts", async () => {
    api.getDashboardSummary.mockRejectedValueOnce(new Error("private backend exception")).mockResolvedValueOnce(admin).mockResolvedValueOnce({ ...admin, metrics: { ...admin.metrics, totalCustomers: 22 } });
    mount();
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private backend exception");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("21", { selector: "dd" });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar resumen" }));
    expect(await screen.findByText("22", { selector: "dd" })).toBeInTheDocument();
  });
  it.each([401, 403])("hides private indicators after an authorization error %s", async (status) => {
    api.getDashboardSummary.mockRejectedValue(new DashboardApiError(status));
    mount();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(document.querySelector("dd")).toBeNull();
  });
  it("does not request the dashboard before authentication or after logout", () => {
    useSessionStore.setState({ status: "anonymous", session: null });
    mount();
    expect(api.getDashboardSummary).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith("/login");
    expect(document.querySelector("dd")).toBeNull();
  });
  it("does not request private data while restoring the session", () => {
    useSessionStore.setState({ status: "initializing", session: null });
    mount();
    expect(screen.getByText("Validando acceso…")).toBeInTheDocument();
    expect(api.getDashboardSummary).not.toHaveBeenCalled();
  });
  it("removes previous metrics if a refreshed request loses authorization", async () => {
    mount();
    await screen.findByText("21", { selector: "dd" });
    api.getDashboardSummary.mockRejectedValueOnce(new DashboardApiError(403));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar resumen" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("21", { selector: "dd" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Accesos rápidos del dashboard" })).not.toBeInTheDocument();
  });
  it("discards previous metrics when switching account and role", async () => {
    const client = mount();
    await screen.findByText("21", { selector: "dd" });
    api.getDashboardSummary.mockReturnValue(new Promise(() => {}));
    act(() => useSessionStore.setState({ session: session("BILLING", "account-2") }));
    expect(screen.queryByText("21", { selector: "dd" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    await waitFor(() => expect(client.getQueryCache().find({ queryKey: ["dashboard-summary", "account-1", "ADMIN"] })).toBeUndefined());
    expect(api.getDashboardSummary).toHaveBeenLastCalledWith("BILLING-token", "BILLING", expect.any(AbortSignal));
  });
});
