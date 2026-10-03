import { expect, test } from "@playwright/test";

import { installCatalogApiFixture, waitForProductQuery } from "./catalog-api-fixture";
import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`landing latest: nine products without filters or pagination, ${theme}, ${width}px`, async ({ page, baseURL }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const { landingRequests, completedLandingRequests, productRequests } = await installCatalogApiFixture(page, "ANONYMOUS", { landingProductCount: 9 });
      await page.goto("/?page=8&search=monitor&categoryId=invalid&sortBy=price");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const section = page.locator('[data-slot="landing-latest"]');
      await expect(section.getByRole("heading", { name: "Lo último en tecnología" })).toBeVisible();
      await expect(section.locator('[data-slot="product-card"]')).toHaveCount(9);
      await expect(section.locator('[data-slot="product-card"] h2')).toHaveText(Array.from({ length: 9 }, (_, index) => `Equipo reciente ${index + 1}`));
      await expect(page.getByText("Destacado de prueba")).toHaveCount(0);
      await expect(page.getByRole("complementary")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Filtros|Ir a la página/ })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: /paginación/i })).toHaveCount(0);
      // React Strict Mode may abort its first development-only mount request.
      // Count completed responses, not cancelled attempts.
      await expect.poll(() => completedLandingRequests.length).toBe(1);
      expect(landingRequests.every((request) => request.search === "")).toBe(true);
      expect(productRequests).toHaveLength(0);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`latest-${theme}-${width}.png`), fullPage: true });
      await section.getByRole("link", { name: "Ver todos los productos" }).click();
      await expect(page).toHaveURL(new URL("/products", baseURL).toString());
      await waitForProductQuery(productRequests, { page: "1", pageSize: "12", view: "public" });
      await expect(page.getByText("Página 1 de 4").last()).toBeVisible();
    });
  }
}

for (const count of [0, 2]) {
  test(`landing latest: ${count} recent products and search directed to the full catalog`, async ({ page }) => {
    const { landingRequests } = await installCatalogApiFixture(page, "ANONYMOUS", { landingProductCount: count });
    await page.goto("/");
    if (count === 0) await expect(page.getByRole("heading", { name: "Todavía no hay novedades" })).toBeVisible();
    else await expect(page.locator('[data-slot="product-card"]')).toHaveCount(count);
    await page.getByRole("searchbox", { name: "Buscar en el catálogo" }).fill(" teclado ");
    await page.getByRole("button", { name: "Buscar productos" }).click();
    await expect(page).toHaveURL(/\/products\?page=1&search=teclado$/);
    expect(landingRequests[0]!.search).toBe("");
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`editorial landing: complete ordered composition, ${theme}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const { completedLandingRequests, productRequests } = await installCatalogApiFixture(page, "ANONYMOUS", { landingEditorial: "full" });
      await page.goto("/?search=ignored&page=8");
      const featured = page.locator('[data-slot="landing-featured"]');
      const latest = page.locator('[data-slot="landing-latest"]');
      const categories = page.locator('[data-slot="landing-category"]');
      await expect(featured.locator('[data-slot="product-card"]')).toHaveCount(3);
      await expect(latest.locator('[data-slot="product-card"]')).toHaveCount(9);
      await expect(categories).toHaveCount(3);
      expect(await page.locator('section[data-slot^="landing-"]').evaluateAll((sections) => sections.map((section) => section.getAttribute("data-slot"))))
        .toEqual(["landing-featured", "landing-latest", "landing-category", "landing-category", "landing-category"]);
      for (let index = 0; index < 3; index++) await expect(categories.nth(index).locator('[data-slot="product-card"]')).toHaveCount(3);
      await expect(categories.locator('h2[id]')).toHaveText(["Notebooks", "Monitores", "Smartphones"]);
      await expect(featured.locator('[data-slot="product-card"] h2')).toHaveText(["Destacado 1", "Destacado 2", "Destacado 3"]);
      await expect(latest.getByRole("heading", { name: /^Destacado/ })).toHaveCount(0);
      await expect(categories.first().getByRole("heading", { name: "Destacado 1", exact: true })).toBeVisible();
      await expect(page.getByRole("complementary")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: /paginación/i })).toHaveCount(0);
      await expect.poll(() => completedLandingRequests.length).toBe(1);
      expect(productRequests).toHaveLength(0);
      const explore = categories.first().getByRole("link", { name: "Explorar Notebooks" });
      await page.keyboard.press("Tab");
      await explore.focus();
      await expectVisibleKeyboardFocus(page);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`editorial-${theme}-${width}.png`), fullPage: true });
      await featured.screenshot({ path: testInfo.outputPath(`featured-${theme}-${width}.png`) });
      await categories.first().screenshot({ path: testInfo.outputPath(`category-${theme}-${width}.png`) });
      await explore.press("Enter");
      await expect(page).toHaveURL(/\/products\?page=1&categoryId=20000000-0000-4000-8000-000000000000$/);
      await waitForProductQuery(productRequests, { categoryId: "20000000-0000-4000-8000-000000000000", page: "1", view: "public" });
    });
  }
}

for (const composition of ["partial", "empty"] as const) {
  test(`editorial landing: ${composition} configuration without artificial products`, async ({ page }) => {
    await installCatalogApiFixture(page, "ANONYMOUS", { landingEditorial: composition });
    await page.goto("/");
    if (composition === "empty") {
      await expect(page.getByRole("heading", { name: "Todavía no hay novedades" })).toBeVisible();
      await expect(page.locator('[data-slot="landing-featured"], [data-slot="landing-category"], [data-slot="product-card"]')).toHaveCount(0);
    } else {
      await expect(page.locator('[data-slot="landing-featured"] [data-slot="product-card"]')).toHaveCount(1);
      await expect(page.locator('[data-slot="landing-latest"] [data-slot="product-card"]')).toHaveCount(2);
      await expect(page.locator('[data-slot="landing-category"]')).toHaveCount(1);
    }
    await expect(page.getByRole("link", { name: "Ver todos los productos" })).toBeVisible();
  });
}

test("editorial landing rejects an invalid public response and retries without leaking inactive content", async ({ page }) => {
  await installCatalogApiFixture(page, "ANONYMOUS", { landingEditorial: "full" });
  let invalid = true;
  await page.route("**/api/v1/catalog/landing", async (route) => {
    if (!invalid) { await route.fallback(); return; }
    await route.fulfill({ contentType: "application/json", headers: {
      "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true",
    }, body: JSON.stringify({ featuredProducts: [{ name: "Inactive private product", status: "INACTIVE", isFeatured: true }], latestProducts: [], highlightedCategories: [] }) });
  });
  await page.goto("/");
  await expect(page.getByText("No pudimos cargar las novedades. Inténtalo nuevamente o explora todos los productos.")).toBeVisible();
  await expect(page.getByText("Inactive private product")).toHaveCount(0);
  await expect(page.locator('[data-slot="product-card"]')).toHaveCount(0);
  invalid = false;
  await page.getByRole("button", { name: "Intentar nuevamente" }).click();
  await expect(page.locator('[data-slot="landing-featured"] [data-slot="product-card"]')).toHaveCount(3);
  await expect(page.locator('[data-slot="landing-category"]')).toHaveCount(3);
});

test("storefront combines search, filters and order with backend pagination, history and reload", async ({ page }) => {
  const { productRequests } = await installCatalogApiFixture(page, "CUSTOMER");

  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Encuentra el equipo que va contigo." })).toBeVisible();
  await expect(page.getByText("37 productos encontrados")).toBeVisible();

  await page.getByRole("searchbox", { name: "Buscar en todos los productos" }).fill("monitor");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/search=monitor/);

  const desktopFilters = page.getByRole("complementary");
  await desktopFilters.locator('select[name="availability"]').selectOption("OUT_OF_STOCK");
  await desktopFilters.locator('select[name="sort"]').selectOption("name:asc");
  await desktopFilters.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page).toHaveURL(/availability=OUT_OF_STOCK/);
  await expect(page).toHaveURL(/sortBy=name/);
  await expect(page).toHaveURL(/sortOrder=asc/);

  const firstFilteredPage = await waitForProductQuery(productRequests, {
    availability: "OUT_OF_STOCK",
    page: "1",
    pageSize: "12",
    search: "monitor",
    sortBy: "name",
    sortOrder: "asc",
    view: "public",
  });
  expect(firstFilteredPage.searchParams.get("pageSize")).toBe("12");
  await expect(page.getByText("37 productos encontrados")).toBeVisible();
  await expect(page.getByText("Página 1 de 4").last()).toBeVisible();

  await page.getByRole("button", { name: "Ir a la página 2" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("heading", { name: "Monitor Nova 27 — página 2" })).toBeVisible();
  await expect(page.getByText("Página 2 de 4").last()).toBeVisible();
  const secondPage = await waitForProductQuery(productRequests, {
    availability: "OUT_OF_STOCK",
    page: "2",
    pageSize: "12",
    search: "monitor",
    sortBy: "name",
    sortOrder: "asc",
    view: "public",
  });
  expect(secondPage.searchParams.get("page")).toBe("2");

  await page.goBack();
  await expect(page).toHaveURL(/page=1/);
  await expect(page).toHaveURL(/search=monitor/);
  await expect(page.getByRole("heading", { name: "Monitor Nova 27", exact: true })).toBeVisible();
  await expect(page.getByText("Página 1 de 4").last()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/availability=OUT_OF_STOCK/);
  await expect(page).toHaveURL(/sortBy=name/);
  await expect(page.getByRole("searchbox", { name: "Buscar en todos los productos" })).toHaveValue("monitor");
  await expect(page.getByText("37 productos encontrados")).toBeVisible();
  await expect(page.getByText("Página 1 de 4").last()).toBeVisible();
  expect(productRequests.some((request) => request.searchParams.get("pageSize") !== "12")).toBe(false);
});
