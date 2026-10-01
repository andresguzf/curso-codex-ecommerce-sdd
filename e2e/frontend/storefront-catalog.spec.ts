import { expect, test } from "@playwright/test";

import { installCatalogApiFixture, waitForProductQuery } from "./catalog-api-fixture";
import { expectAccessible, expectNoPageOverflow } from "./accessibility-helpers";

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`landing latest: nine products without filters or pagination, ${theme}, ${width}px`, async ({ page }, testInfo) => {
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
      await expect(page).toHaveURL("http://localhost:3000/products");
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
