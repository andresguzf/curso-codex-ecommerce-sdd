import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "../src/features/auth/session";
import { CheckoutForm } from "../src/features/checkout/checkout-form";
import { CheckoutApiError } from "../src/features/checkout/checkout-api";
import { CheckoutReceipt } from "../src/features/checkout/checkout-receipt";

const mocks = vi.hoisted(() => ({ cart: vi.fn(), shipping: vi.fn(), submit: vi.fn(), receipt: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock("../src/features/cart/cart-api", () => ({ getCart: mocks.cart }));
vi.mock("../src/features/checkout/checkout-api", async (original) => ({
  ...await original<typeof import("../src/features/checkout/checkout-api")>(),
  getCheckoutShippingOptions: mocks.shipping, submitCheckout: mocks.submit, getCheckoutReceipt: mocks.receipt,
}));
const orderId = "3296f1d5-5a1d-4b94-9caa-b26878f447e4";
const result = {
  order: { id: orderId, number: "ORD-DEMO", currency: "USD", status: "PROCESSING", subtotal: "100.00", shippingTotal: "5.00", taxTotal: "0.00", total: "105.00", items: [{ productId: "p1", name: "Teclado", quantity: 1, lineTotal: "100.00" }] },
  payment: { status: "APPROVED" },
};
function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><CheckoutForm /></QueryClientProvider>);
  return client;
}
async function fill() {
  await screen.findByRole("heading", { name: "Completa tu compra" });
  for (const [label, value] of [["Dirección", "Av. Central 123"], ["Ciudad", "Santiago"], ["Región o estado", "Metropolitana"], ["Código postal", "8320000"]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  useSessionStore.getState().setSession({ accessToken: "token", accessTokenExpiresAt: "2030-01-01T00:00:00Z", sessionExpiresAt: "2030-01-02T00:00:00Z", tokenType: "Bearer", user: { id: orderId, displayName: "Cliente", email: "customer@example.com", role: "CUSTOMER" } });
  mocks.cart.mockResolvedValue({ id: "cart-1", customerId: orderId, subtotal: "100.00", total: "100.00", totalQuantity: 1, items: [{ id: "item-1", quantity: 1, subtotal: "100.00", product: { name: "Teclado", isAvailable: true, stockAvailable: 4 } }] });
  mocks.shipping.mockResolvedValue([{ method: "PICKUP", cost: "0.00", currency: "USD" }, { method: "STANDARD", cost: "5.00", currency: "USD" }]);
  mocks.submit.mockReset();
  mocks.submit.mockResolvedValue(result);
  mocks.receipt.mockResolvedValue(result);
});
describe("checkout form", () => {
  it("validates address, uses API shipping costs and navigates to the created order", async () => {
    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar compra simulada" }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(mocks.submit).not.toHaveBeenCalled();
    await fill();
    fireEvent.click(screen.getByLabelText(/Envío estándar/));
    expect(screen.getByText("$105.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra simulada" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/checkout/orders/${orderId}`));
    expect(mocks.submit).toHaveBeenCalledWith("token", expect.objectContaining({ shippingMethod: "STANDARD", shippingAddress: expect.objectContaining({ line1: "Av. Central 123" }) }), expect.any(String));
  });
  it("preserves the address after a rejected payment and starts a new attempt after correction", async () => {
    mocks.submit.mockRejectedValueOnce(new CheckoutApiError(409, "PAYMENT_REJECTED"));
    renderForm(); await fill();
    fireEvent.click(screen.getByLabelText(/rechazar pago/));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra simulada" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("rechazado");
    expect(screen.getByLabelText("Dirección")).toHaveValue("Av. Central 123");
    fireEvent.click(screen.getByLabelText(/aprobar pago/));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra simulada" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[0][2]).not.toBe(mocks.submit.mock.calls[1][2]);
  });
  it("retries an uncertain network result using the exact same request and idempotency key", async () => {
    mocks.submit.mockRejectedValueOnce(new TypeError("Network failed"));
    renderForm(); await fill();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra simulada" }));
    const retry = await screen.findByRole("button", { name: "Reintentar la misma compra" });
    expect(screen.getByLabelText("Dirección")).toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(mocks.submit.mock.calls[1]).toEqual(mocks.submit.mock.calls[0]);
  });
  it("reports stock conflicts and keeps the cart available for correction", async () => {
    mocks.submit.mockRejectedValueOnce(new CheckoutApiError(409, "CHECKOUT_INSUFFICIENT_STOCK"));
    renderForm(); await fill();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar compra simulada" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El stock cambió");
    expect(screen.getByRole("link", { name: /Revisar carrito/ })).toHaveAttribute("href", "/cart");
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("loads a receipt through REST after a page reload", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><CheckoutReceipt orderId={orderId} /></QueryClientProvider>);
    expect(await screen.findByRole("heading", { name: "Tu pedido está en proceso" })).toBeInTheDocument();
    expect(mocks.receipt).toHaveBeenCalledWith("token", orderId);
    expect(screen.getByText("$105.00")).toBeInTheDocument();
  });
});
