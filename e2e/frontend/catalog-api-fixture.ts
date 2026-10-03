import { expect, type Page, type Request } from "@playwright/test";
import type { CatalogImage } from "@technology-ecommerce/api-schemas";

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

function productPage(page: number, pageSize: number, imageUrl = "/images/product-placeholder.svg") {
  return {
    items: [{
      category: null,
      createdAt: "2026-09-04T12:00:00.000Z",
      currency: "USD",
      description: "Monitor de prueba para validar los criterios del catálogo.",
      id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
      image: { storageKey: "defaults/products/monitor.svg", url: imageUrl },
      coverImage: { id: "18ef6b72-3291-4bd7-a68f-0eec92d54d7c", storageKey: "defaults/products/monitor.svg", url: imageUrl, altText: "Portada del monitor", isPrimary: true, sortOrder: 0, width: null, height: null, mimeType: null },
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

export async function installCatalogApiFixture(page: Page, role: "ADMIN" | "CUSTOMER" | "BILLING" | "ANONYMOUS", options: { landingEditorial?: "full" | "partial" | "empty"; editorialCategories?: boolean; landingProductCount?: number; galleryImageCount?: number; galleryImageUrl?: string; imageUploadTimeout?: boolean } = {}) {
  const productRequests: URL[] = [];
  const landingRequests: URL[] = [];
  const completedLandingRequests: URL[] = [];
  page.on("requestfinished", (request) => {
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/catalog/landing") completedLandingRequests.push(url);
  });
  let cartHasItem = true;
  let productDeleteFails = false;
  let isFeatured = false;
  let featuredAt: string | null = null;
  const editorialRequests: Record<string, unknown>[] = [];
  const imageUploadRequests: Request[] = [];
  const imageEditRequests: { imageId: string; input: Record<string, unknown> }[] = [];
  const imageDeleteRequests: string[] = [];
  let galleryImages: CatalogImage[] = Array.from({ length: options.galleryImageCount ?? 1 }, (_, index) => ({
    ...productPage(1, 12).items[0]!.coverImage,
    id: index === 0 ? productPage(1, 12).items[0]!.coverImage.id : `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    altText: `Vista ${index + 1} del monitor`, isPrimary: index === 0, sortOrder: index,
    url: options.galleryImageUrl ?? productPage(1, 12).items[0]!.coverImage.url,
  }));
  const categoryEditorialRequests: { id: string; input: Record<string, unknown> }[] = [];
  let editorialCategories = ["Portátiles", "Monitores", "Periféricos", "Audio", "Legado"].map((name, index) => ({
    id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`, name, slug: `categoria-${index}`,
    description: "Categoría de prueba", status: index === 4 ? "INACTIVE" : "ACTIVE", deletedAt: null,
    createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z", showOnLanding: false, landingOrder: null as number | null,
  }));
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

    if (request.method() === "DELETE" && /^\/api\/v1\/products\/[\w-]+$/.test(url.pathname)) {
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

    if (options.editorialCategories && url.pathname.startsWith("/api/v1/categories/") && request.method() === "PATCH") {
      const id = url.pathname.split("/").at(-1)!;
      const input = request.postDataJSON() as Record<string, unknown>;
      categoryEditorialRequests.push({ id, input });
      const previous = editorialCategories.find((category) => category.id === id)!;
      if (role !== "ADMIN") { await route.fulfill({ status: 403, headers, contentType: "application/json", body: JSON.stringify({ code: "FORBIDDEN" }) }); return; }
      if (input.showOnLanding === true && !previous.showOnLanding && editorialCategories.filter((category) => category.showOnLanding).length === 3) {
        await route.fulfill({ status: 409, headers, contentType: "application/json", body: JSON.stringify({ code: "CATEGORY_LANDING_LIMIT_EXCEEDED" }) }); return;
      }
      const position = typeof input.landingOrder === "number" ? input.landingOrder : input.showOnLanding === true
        ? [1, 2, 3].find((slot) => !editorialCategories.some((category) => category.landingOrder === slot))! : null;
      editorialCategories = editorialCategories.map((category) => category.id === id
        ? { ...category, showOnLanding: typeof input.showOnLanding === "boolean" ? input.showOnLanding : category.showOnLanding, landingOrder: position }
        : input.landingOrder !== undefined && category.landingOrder === position ? { ...category, landingOrder: previous.landingOrder } : category);
      await route.fulfill({ headers, contentType: "application/json", body: JSON.stringify(editorialCategories.find((category) => category.id === id)) }); return;
    }

    if (options.editorialCategories && url.pathname === "/api/v1/categories" && request.method() === "GET") {
      const admin = url.searchParams.get("view") === "administrative";
      if (admin && role !== "ADMIN") { await route.fulfill({ status: 403, headers, contentType: "application/json", body: JSON.stringify({ code: "FORBIDDEN" }) }); return; }
      const filtered = editorialCategories.filter((category) => (admin || category.status === "ACTIVE") &&
        (!url.searchParams.has("showOnLanding") || category.showOnLanding === (url.searchParams.get("showOnLanding") === "true")));
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const requestedPage = Number(url.searchParams.get("page") ?? 1);
      const items = filtered.slice((requestedPage - 1) * pageSize, requestedPage * pageSize).map(({ showOnLanding, landingOrder, ...category }) => ({ ...category, ...(admin ? { showOnLanding, landingOrder } : {}) }));
      await route.fulfill({ headers, contentType: "application/json", body: JSON.stringify({ items, page: requestedPage, pageSize, totalItems: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) }) }); return;
    }

    if (url.pathname === "/api/v1/categories" || url.pathname === "/api/v1/tags") {
      await route.fulfill({
        body: JSON.stringify(emptyClassificationPage),
        contentType: "application/json",
        headers,
      });
      return;
    }

    if (url.pathname === "/api/v1/products/10184fd0-3dcb-47cf-af70-a8be4c765421/images" && request.method() === "POST") {
      imageUploadRequests.push(request);
      if (options.imageUploadTimeout) {
        await route.fulfill({ status: 504, headers, json: { code: "IMAGE_STORAGE_TIMEOUT", message: "Image storage timed out", correlationId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4" } });
        return;
      }
      const image = {
        id: `20000000-0000-4000-8000-${String(100 + imageUploadRequests.length).padStart(12, "0")}`,
        productId: "10184fd0-3dcb-47cf-af70-a8be4c765421", storageKey: "uploads/monitor.png",
        url: "/images/product-placeholder.svg", altText: url.searchParams.get("altText") ?? "Imagen subida",
        isPrimary: galleryImages.length === 0, sortOrder: galleryImages.length,
        width: 1, height: 1, mimeType: request.headers()["content-type"],
        createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
      };
      const { productId: _productId, createdAt: _createdAt, updatedAt: _updatedAt, ...publicImage } = image;
      galleryImages = [...galleryImages, publicImage];
      await route.fulfill({ status: 201, headers, json: image });
      return;
    }

    if (/^\/api\/v1\/products\/10184fd0-3dcb-47cf-af70-a8be4c765421\/images\/[\w-]+$/.test(url.pathname) && request.method() === "DELETE") {
      const imageId = url.pathname.split("/").at(-1)!;
      imageDeleteRequests.push(imageId);
      const current = galleryImages.find((image) => image.id === imageId);
      if (!current || current.isPrimary) {
        await route.fulfill({ status: current ? 409 : 404, headers, json: { code: current ? "PRODUCT_PRIMARY_IMAGE_REQUIRED" : "PRODUCT_IMAGE_NOT_FOUND", message: "Image cannot be removed" } });
        return;
      }
      galleryImages = galleryImages.filter((image) => image.id !== imageId).map((image, index) => ({ ...image, sortOrder: index }));
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (/^\/api\/v1\/products\/10184fd0-3dcb-47cf-af70-a8be4c765421\/images\/[\w-]+$/.test(url.pathname) && request.method() === "PATCH") {
      const imageId = url.pathname.split("/").at(-1)!;
      const input = request.postDataJSON() as Record<string, unknown>;
      imageEditRequests.push({ imageId, input });
      const current = galleryImages.find((image) => image.id === imageId)!;
      const changed = { ...current, ...(typeof input.altText === "string" ? { altText: input.altText } : {}), ...(input.isPrimary === true ? { isPrimary: true } : {}) };
      galleryImages = galleryImages.map((image) => image.id === imageId ? changed : input.isPrimary === true ? { ...image, isPrimary: false } : image);
      if (typeof input.sortOrder === "number") {
        galleryImages = galleryImages.filter((image) => image.id !== imageId);
        galleryImages.splice(input.sortOrder, 0, changed);
      }
      galleryImages = galleryImages.map((image, index) => ({ ...image, sortOrder: index }));
      await route.fulfill({ headers, json: { ...galleryImages.find((image) => image.id === imageId), productId: "10184fd0-3dcb-47cf-af70-a8be4c765421", createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z" } });
      return;
    }

    if (url.pathname === "/api/v1/products/10184fd0-3dcb-47cf-af70-a8be4c765421" && request.method() === "GET") {
      await route.fulfill({
        body: JSON.stringify({ ...productPage(1, 12).items[0], availability: "IN_STOCK", coverImage: galleryImages.find((image) => image.isPrimary) ?? null, images: galleryImages }),
        contentType: "application/json",
        headers,
      });
      return;
    }

    if (url.pathname === "/api/v1/products/10184fd0-3dcb-47cf-af70-a8be4c765421" && request.method() === "PATCH") {
      const input = request.postDataJSON() as Record<string, unknown>;
      editorialRequests.push(input);
      if (role !== "ADMIN") {
        await route.fulfill({ status: 403, headers, contentType: "application/json", body: JSON.stringify({ code: "FORBIDDEN", message: "Forbidden" }) });
        return;
      }
      if (typeof input.isFeatured === "boolean" && input.isFeatured !== isFeatured) {
        isFeatured = input.isFeatured;
        featuredAt = isFeatured ? new Date().toISOString() : null;
      }
      await route.fulfill({ headers, contentType: "application/json", body: JSON.stringify({ ...productPage(1, 20).items[0], isFeatured, featuredAt, deletedAt: null }) });
      return;
    }

    if (url.pathname === "/api/v1/products" && request.method() === "GET") {
      productRequests.push(url);
      const requestedPage = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      await route.fulfill({
        body: JSON.stringify({ ...productPage(requestedPage, pageSize), items: productPage(requestedPage, pageSize, options.galleryImageUrl).items.map((product) => ({ ...product, ...(url.searchParams.get("view") === "administrative" ? { isFeatured, featuredAt } : {}) })) }),
        contentType: "application/json",
        headers,
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/api/v1/catalog/landing") {
      landingRequests.push(url);
      const product = productPage(1, 9).items[0]!;
      const editorialCount = options.landingEditorial === "full" ? 3 : options.landingEditorial === "partial" ? 1 : 0;
      const count = options.landingProductCount ?? (options.landingEditorial === "full" ? 9 : options.landingEditorial === "partial" ? 2 : options.landingEditorial === "empty" ? 0 : 1);
      const categories = Array.from({ length: editorialCount }, (_, index) => ({
        id: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        name: ["Notebooks", "Monitores", "Smartphones"][index]!, slug: `categoria-${index}`, status: "ACTIVE",
      }));
      const latestProducts = Array.from({ length: count }, (_, index) => ({
        ...product,
        category: categories.length ? categories[index % categories.length]! : null,
        ...(count === 1 ? {} : { id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, name: `Equipo reciente ${index + 1}`, sku: `RECENT-${index + 1}`, slug: `equipo-reciente-${index + 1}` }),
        createdAt: new Date(Date.parse(product.createdAt) - index * 86_400_000).toISOString(),
      }));
      const featuredProducts = Array.from({ length: editorialCount }, (_, index) => ({
        ...product, id: `99999999-0000-4000-8000-${String(index).padStart(12, "0")}`,
        name: `Destacado ${index + 1}`, slug: `destacado-${index + 1}`, sku: `FEATURED-${index + 1}`, category: categories[index]!,
      }));
      const highlightedCategories = categories.map((category) => ({
        category, products: [...featuredProducts, ...latestProducts].filter((item) => item.category?.id === category.id).slice(0, 3),
      }));
      await route.fulfill({
        body: JSON.stringify({ featuredProducts, latestProducts, highlightedCategories }),
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

  return { productRequests, landingRequests, completedLandingRequests, editorialRequests, imageUploadRequests, imageEditRequests, imageDeleteRequests, categoryEditorialRequests, failProductDeletion: () => { productDeleteFails = true; } };
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
