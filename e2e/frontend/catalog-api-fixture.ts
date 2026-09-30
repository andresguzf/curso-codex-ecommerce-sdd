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

export async function installCatalogApiFixture(page: Page, role: "ADMIN" | "CUSTOMER") {
  const productRequests: URL[] = [];
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

    if (url.pathname === "/api/v1/categories" || url.pathname === "/api/v1/tags") {
      await route.fulfill({
        body: JSON.stringify(emptyClassificationPage),
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

  return { productRequests };
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
