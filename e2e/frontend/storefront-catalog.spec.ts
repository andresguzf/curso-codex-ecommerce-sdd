import { expect, test } from "@playwright/test";

import { installCatalogApiFixture, waitForProductQuery } from "./catalog-api-fixture";

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
