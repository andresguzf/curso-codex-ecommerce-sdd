import type { Page } from "@playwright/test";
import type { CustomerOrderDetail, InvoiceResponse } from "@technology-ecommerce/api-schemas";
import { installCatalogApiFixture } from "./catalog-api-fixture";

export const customerDocumentId = "16f7d829-e4c8-4a78-a883-4e21b2d8a957";
const productId = "10184fd0-3dcb-47cf-af70-a8be4c765421";
const customerId = "6ec53bda-6010-4582-8a66-59e042e875be";
const timestamp = "2026-09-01T12:00:00Z";
const order: CustomerOrderDetail = {
  id: customerDocumentId, number: "ORD-HISTORIC-1", status: "PROCESSING", currency: "USD",
  subtotal: "200.00", shippingTotal: "5.00", taxTotal: "0.00", total: "205.00",
  createdAt: timestamp, updatedAt: timestamp, cancelledAt: null,
  customerSnapshot: { displayName: "Nombre histórico", email: "historic@example.com" },
  shippingAddressSnapshot: { recipientName: "Destinatario original", line1: "Calle Antigua 123", line2: "Depto 4", city: "Santiago", region: "RM", postalCode: "8320000", countryCode: "CL" },
  shippingMethodSnapshot: { method: "STANDARD", name: "Envío estándar histórico", cost: "5.00" },
  paymentSnapshot: { status: "APPROVED", method: "SIMULATED_CARD_APPROVED", providerReference: "SIM-ORIGINAL" },
  items: [{ productId, name: "Teclado histórico", sku: "TECH-OLD", quantity: 2, unitPrice: "100.00", lineTotal: "200.00", taxAmount: "0.00", currency: "USD" }],
};
const invoice: InvoiceResponse = {
  id: customerDocumentId, number: "INV-CUSTOMER-1", origin: "ORDER", status: "PAID", orderId: customerDocumentId, customerId, createdByUserId: null, currency: "USD",
  subtotal: "200.00", shippingTotal: "5.00", taxTotal: "0.00", total: "205.00",
  issuerSnapshot: { legalName: "Tienda histórica" }, customerSnapshot: order.customerSnapshot,
  createdAt: timestamp, updatedAt: timestamp, issuedAt: timestamp, dueAt: null, paidAt: timestamp, voidedAt: null,
  lines: [{ productId, position: 1, skuSnapshot: "TECH-OLD", nameSnapshot: "Teclado histórico", descriptionSnapshot: "Descripción histórica", quantity: 2, unitPrice: "100.00", taxRate: "0.0000", taxAmount: "0.00", lineSubtotal: "200.00", lineTotal: "200.00", currency: "USD" }],
};

/** Browser-only REST fixtures: no request reaches development API or Supabase. */
export async function installCustomerApiFixture(page: Page) {
  await installCatalogApiFixture(page, "CUSTOMER");
  let quantity = 1;
  const checkoutRequests: { key: string | undefined; body: Record<string, unknown> }[] = [];
  const state = { documents: "ready" as "ready" | "empty" | "error", checkoutPending: null as Promise<void> | null };
  await page.route("http://localhost:3001/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") { await route.fallback(); return; }
    const headers = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };
    const reply = async (json: unknown, status = 200) => route.fulfill({ headers, json, status });
    if (path === "/api/v1/cart" || path.startsWith("/api/v1/cart/items/")) {
      if (request.method() === "PATCH") quantity = (request.postDataJSON() as { quantity: number }).quantity;
      if (request.method() === "DELETE") quantity = 0;
      const total = (quantity * 299.90).toFixed(2);
      await reply({ id: "208d27de-e0d6-4ef8-83c1-72e4a2dbe952", customerId, status: "ACTIVE", currency: "USD", subtotal: total, total, totalQuantity: quantity, createdAt: timestamp, updatedAt: timestamp,
        items: quantity ? [{ id: "739f9d74-7c79-4e8e-b76b-c1d4076762df", productId, quantity, subtotal: total, createdAt: timestamp, updatedAt: timestamp,
          product: { id: productId, name: "Monitor Nova 27", sku: "MON-NOVA-27", price: "299.90", currency: "USD", stockAvailable: 14, isAvailable: true, image: { url: "/images/product-placeholder.svg", storageKey: "defaults/products/monitor.svg" } } }] : [] });
      return;
    }
    if (path === "/api/v1/checkout/shipping-methods") {
      await reply([{ method: "PICKUP", cost: "0.00", currency: "USD" }, { method: "STANDARD", cost: "5.00", currency: "USD" }]); return;
    }
    if (path === "/api/v1/checkout" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      checkoutRequests.push({ key: request.headers()["idempotency-key"], body });
      if (state.checkoutPending) await state.checkoutPending;
      if (body.paymentMethod === "SIMULATED_CARD_REJECTED") { await reply({ code: "PAYMENT_REJECTED", message: "Rejected fixture", correlationId: "customer-design" }, 422); return; }
      await reply({ order: { id: customerDocumentId, number: "ORD-DEMO-1", status: "PROCESSING", currency: "USD", subtotal: "299.90", shippingTotal: "5.00", taxTotal: "0.00", total: "304.90", items: [{ productId, sku: "MON-NOVA-27", name: "Monitor Nova 27", quantity: 1, unitPrice: "299.90", taxAmount: "0.00", lineTotal: "299.90", currency: "USD" }], createdAt: timestamp }, payment: { status: "APPROVED", method: "SIMULATED_CARD_APPROVED", providerReference: "SIM-DEMO" } }); return;
    }
    if (path === "/api/v1/wishlist") {
      if (state.documents === "error") { await reply({ code: "INTERNAL_ERROR", message: "Fixture error", correlationId: "customer-design" }, 500); return; }
      const items = state.documents === "empty" ? [] : [{ id: customerDocumentId, productId, createdAt: timestamp, productStatus: "ACTIVE", productDeletedAt: null,
        product: { id: productId, name: "Monitor Nova 27", slug: "monitor-nova-27", price: "299.90", currency: "USD", stockAvailable: 14, isAvailable: true, image: { url: "/images/product-placeholder.svg", storageKey: "defaults/products/monitor.svg" } } }];
      await reply({ items, page: 1, pageSize: 12, totalItems: items.length, totalPages: items.length ? 1 : 0 }); return;
    }
    if (path === "/api/v1/orders/mine" || path === "/api/v1/invoices" || path === `/api/v1/orders/${customerDocumentId}` || path === `/api/v1/invoices/${customerDocumentId}`) {
      if (state.documents === "error") { await reply({ code: "INTERNAL_ERROR", message: "Fixture error", correlationId: "customer-design" }, 500); return; }
      const document = path.includes("invoices") ? invoice : order;
      const items = state.documents === "empty" ? [] : [document];
      await reply(path.endsWith("/mine") || path === "/api/v1/invoices" ? { items, page: 1, pageSize: 20, totalItems: items.length, totalPages: items.length ? 1 : 0 } : document); return;
    }
    await route.fallback();
  });
  return { state, checkoutRequests };
}
