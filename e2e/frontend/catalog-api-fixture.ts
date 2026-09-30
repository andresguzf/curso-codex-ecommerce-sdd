import { expect, type Page, type Request } from "@playwright/test";

const apiBaseUrl = "http://localhost:3001";
const csrfToken = "playwright-csrf-token-012345678901234567890123";

const users = {
  ADMIN: {
    displayName: "Prueba Administrativa",
    email: "admin@example.test",
    id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
    role: "ADMIN",
  },
  CUSTOMER: {
    displayName: "Cliente de Prueba",
    email: "customer@example.test",
    id: "6ec53bda-6010-4582-8a66-59e042e875be",
    role: "CUSTOMER",
  },
  BILLING: {
    displayName: "Prueba de Facturación",
    email: "billing@example.test",
    id: "38e178f4-6719-4552-8aae-206b465d0de9",
    role: "BILLING",
  },
} as const;

function corsHeaders(request: Request): Record<string, string> {
  const requestHeaders = request.headers();
  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type,x-csrf-token,idempotency-key",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-origin": requestHeaders.origin ?? "http://localhost:3000",
    "access-control-expose-headers": "X-CSRF-Token",
    vary: "Origin",
  };
}

function productPage(page: number, pageSize: number) {
  return {
    items: [{
      category: null,
      createdAt: "2026-09-04T12:00:00.000Z",
      currency: "USD",
      description: "Monitor de prueba para validar los criterios del catálogo.",
      id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
      image: { storageKey: "defaults/products/monitor.svg", url: "/images/product-placeholder.svg" },
      name: page === 2 ? "Monitor Nova 27 — página 2" : "Monitor Nova 27",
      price: "299.90",
      sku: "MON-NOVA-27",
      slug: "monitor-nova-27",
      status: "ACTIVE",
      stockAvailable: 14,
      tags: [],
      updatedAt: "2026-09-04T12:00:00.000Z",
    }],
    page,
    pageSize,
    totalItems: 37,
    totalPages: 4,
  };
}

export async function installCatalogApiFixture(page: Page, role: "ADMIN" | "CUSTOMER" | "BILLING" | "ANONYMOUS") {
  const productRequests: URL[] = [];
  let cartHasItem = true;
  let productDeleteFails = false;
  const emptyClassificationPage = {
    items: [],
    page: 1,
    pageSize: 100,
    totalItems: 0,
    totalPages: 0,
  };

  await page.route(`${apiBaseUrl}/api/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = corsHeaders(request);

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/api/v1/auth/csrf") {
      await route.fulfill({
        body: JSON.stringify({ csrfToken }),
        contentType: "application/json",
        headers,
      });
      return;
    }

    if (url.pathname === "/api/v1/auth/refresh" || url.pathname === "/api/v1/auth/me") {
      if (role === "ANONYMOUS") {
        await route.fulfill({ status: 401, headers, contentType: "application/json", body: JSON.stringify({ code: "AUTH_REQUIRED", message: "Sesión requerida", correlationId: "playwright" }) });
        return;
      }
      const user = users[role];
      const body = url.pathname.endsWith("/me")
        ? user
        : {
            accessToken: `playwright-${role.toLowerCase()}-access-token`,
            accessTokenExpiresAt: "2030-09-04T12:00:00.000Z",
            sessionExpiresAt: "2030-09-11T12:00:00.000Z",
            tokenType: "Bearer",
            user,
          };
      await route.fulfill({
        body: JSON.stringify(body),
        contentType: "application/json",
        headers: { ...headers, "X-CSRF-Token": csrfToken },
      });
      return;
    }

    if (url.pathname === "/api/v1/cart" || url.pathname.startsWith("/api/v1/cart/items/")) {
      if (request.method() === "DELETE") cartHasItem = false;
      const product = productPage(1, 12).items[0]!;
      const timestamp = "2026-09-04T12:00:00.000Z";
      const cart = {
        id: "208d27de-e0d6-4ef8-83c1-72e4a2dbe952", customerId: role === "CUSTOMER" ? users.CUSTOMER.id : null,
        status: "ACTIVE", currency: "USD", subtotal: cartHasItem ? "299.90" : "0.00", total: cartHasItem ? "299.90" : "0.00",
        totalQuantity: cartHasItem ? 1 : 0, createdAt: timestamp, updatedAt: timestamp,
        items: cartHasItem ? [{ id: "739f9d74-7c79-4e8e-b76b-c1d4076762df", productId: product.id, quantity: 1, subtotal: "299.90",
          product: { ...product, isAvailable: true }, createdAt: timestamp, updatedAt: timestamp }] : [],
      };
      await route.fulfill({ headers, contentType: "application/json", body: JSON.stringify(cart) });
      return;
    }

    if (request.method() === "DELETE" && url.pathname.startsWith("/api/v1/products/")) {
      await route.fulfill(productDeleteFails
        ? { status: 500, headers, contentType: "application/json", body: JSON.stringify({ code: "INTERNAL_ERROR", message: "Error interno", correlationId: "playwright" }) }
        : { status: 204, headers });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/api/v1/dashboard/summary") {
      const updatedAt = "2026-09-30T12:00:00.000Z";
      const body = role === "ADMIN" ? {
        role, updatedAt, lowStockThreshold: 5,
        metrics: { totalCustomers: 21, activeProducts: 18, lowStockProducts: 4, processingOrders: 3, pendingInvoices: 2 },
      } : {
        role, updatedAt, period: { from: "2026-08-31T12:00:00.000Z", to: updatedAt, basis: "paidAt" },
        metrics: { ordersEligibleForInvoicing: 2, ordersAwaitingInvoice: 3, pendingInvoices: 1, paidInvoices: 7 },
      };
      await route.fulfill({ headers, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }

    if (request.method() === "GET" && (url.pathname === "/api/v1/orders" || url.pathname === "/api/v1/invoices")) {
      const timestamp = "2026-09-09T12:00:00Z";
      const common = {
        id: "421d45a3-104e-4413-b79f-25290d1cb0a3", currency: "USD",
        subtotal: "100.00", shippingTotal: "0.00", taxTotal: "0.00", total: "100.00",
        createdAt: timestamp, updatedAt: timestamp, customerId: users.CUSTOMER.id,
        customerSnapshot: { displayName: "Cliente histórico", email: "historic@example.com" },
      };
      const item = url.pathname.endsWith("/orders")
        ? { ...common, number: "ORD-001", status: "PROCESSING", cancelledAt: null }
        : { ...common, issuerSnapshot: {}, number: null, status: "DRAFT", origin: "MANUAL", orderId: null,
            createdByUserId: users.ADMIN.id, issuedAt: null, dueAt: null, paidAt: null, voidedAt: null };
      await route.fulfill({ headers, contentType: "application/json", body: JSON.stringify({
        items: [item], page: 1, pageSize: 20, totalItems: 1, totalPages: 1,
      }) });
      return;
    }

    if (url.pathname === "/api/v1/inventory/10184fd0-3dcb-47cf-af70-a8be4c765421/movements" && request.method() === "GET") {
      await route.fulfill({
        headers, contentType: "application/json", body: JSON.stringify({ ...emptyClassificationPage, pageSize: 20 }),
      });
      return;
    }

    if (url.pathname === "/api/v1/categories" || url.pathname === "/api/v1/tags") {
      await route.fulfill({
        body: JSON.stringify(emptyClassificationPage),
        contentType: "application/json",
        headers,
      });
      return;
    }

    if (url.pathname === "/api/v1/products/10184fd0-3dcb-47cf-af70-a8be4c765421" && request.method() === "GET") {
      await route.fulfill({
        body: JSON.stringify({ ...productPage(1, 12).items[0], availability: "IN_STOCK" }),
        contentType: "application/json",
        headers,
      });
      return;
    }

    if (url.pathname === "/api/v1/products" && request.method() === "GET") {
      productRequests.push(url);
      const requestedPage = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      await route.fulfill({
        body: JSON.stringify(productPage(requestedPage, pageSize)),
        contentType: "application/json",
        headers,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({ code: "TEST_ROUTE_NOT_FOUND", correlationId: "playwright", message: "Unexpected API request" }),
      contentType: "application/json",
      headers,
      status: 404,
    });
  });

  return { productRequests, failProductDeletion: () => { productDeleteFails = true; } };
}

export async function waitForProductQuery(
  requests: readonly URL[],
  criteria: Readonly<Record<string, string>>,
): Promise<URL> {
  const matchesCriteria = (request: URL) =>
    Object.entries(criteria).every(([key, value]) => request.searchParams.get(key) === value);
  await expect.poll(() => requests.some(matchesCriteria)).toBe(true);
  return requests.find(matchesCriteria)!;
}
