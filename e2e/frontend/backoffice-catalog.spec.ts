import { expect, test } from "@playwright/test";

import { installCatalogApiFixture, waitForProductQuery } from "./catalog-api-fixture";

test("backoffice combines search, filters and order with backend pagination, history and reload", async ({ page }) => {
  const { productRequests } = await installCatalogApiFixture(page, "ADMIN");

  await page.goto("/products?page=3&pageSize=10&search=teclado&status=ACTIVE&availability=IN_STOCK&sortBy=name&sortOrder=asc");
  await expect(page.getByRole("heading", { name: "Productos", exact: true })).toBeVisible();
  await expect(page.getByText("Página 3 de 4")).toBeVisible();
  await expect(page.getByText("37 productos")).toBeVisible();

  await page.getByRole("searchbox", { name: "Buscar productos" }).fill("monitor");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page).toHaveURL(/search=monitor/);

  await page.getByRole("button", { name: "Mostrar filtros" }).click();
  await page.getByRole("combobox", { name: "Estado" }).selectOption("INACTIVE");
  await page.getByRole("combobox", { name: "Disponibilidad" }).selectOption("OUT_OF_STOCK");
  await page.getByRole("combobox", { name: "Ordenar por" }).selectOption("price");
  await page.getByRole("combobox", { name: "Dirección" }).selectOption("desc");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(/status=INACTIVE/);
  await expect(page).toHaveURL(/availability=OUT_OF_STOCK/);
  await expect(page).toHaveURL(/sortBy=price/);
  await expect(page).not.toHaveURL(/sortOrder=desc/);

  const firstFilteredPage = await waitForProductQuery(productRequests, {
    availability: "OUT_OF_STOCK",
    page: "1",
    pageSize: "10",
    search: "monitor",
    sortBy: "price",
    sortOrder: "desc",
    status: "INACTIVE",
    view: "administrative",
  });
  expect(firstFilteredPage.searchParams.get("pageSize")).toBe("10");
  await expect(page.getByText("37 productos")).toBeVisible();
  await expect(page.getByText("Página 1 de 4")).toBeVisible();

  await page.getByRole("button", { name: "Ir a la página 2" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Monitor Nova 27 — página 2", { exact: true })).toBeVisible();
  await expect(page.getByText("Página 2 de 4")).toBeVisible();
  await waitForProductQuery(productRequests, {
    availability: "OUT_OF_STOCK",
    page: "2",
    pageSize: "10",
    search: "monitor",
    sortBy: "price",
    sortOrder: "desc",
    status: "INACTIVE",
    view: "administrative",
  });

  await page.goBack();
  await expect(page).toHaveURL(/page=1/);
  await expect(page).toHaveURL(/search=monitor/);
  await expect(page.getByText("Página 1 de 4")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/availability=OUT_OF_STOCK/);
  await expect(page).toHaveURL(/sortBy=price/);
  await expect(page.getByRole("searchbox", { name: "Buscar productos" })).toHaveValue("monitor");
  await expect(page.getByText("37 productos")).toBeVisible();
  await expect(page.getByText("Página 1 de 4")).toBeVisible();
  expect(productRequests.some((request) => request.searchParams.get("pageSize") !== "10")).toBe(false);
});
