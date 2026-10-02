import { expect, test } from "@playwright/test";

import { installCatalogApiFixture, waitForProductQuery } from "./catalog-api-fixture";
import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`administrative image deletion: ${theme}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
      const { imageDeleteRequests, editorialRequests } = await installCatalogApiFixture(page, "ADMIN", { galleryImageCount: 4 });
      await page.goto("/products");
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      const gallery = page.getByRole("region", { name: "Galería de imágenes" });
      await expect(gallery.getByLabel("4 de 4 imágenes")).toBeVisible();
      await page.getByLabel("Nombre", { exact: true }).fill("Borrador conservado");
      await expect(gallery.getByRole("button", { name: "Eliminar Vista 1 del monitor" })).toBeDisabled();
      const trigger = gallery.getByRole("button", { name: "Eliminar Vista 2 del monitor" });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Eliminar imagen del producto" });
      await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
      await expectAccessible(page); await expectNoPageOverflow(page);
      await dialog.screenshot({ path: `test-results/frontends/product-image-deletion-${theme}-${width}.png` });
      await dialog.getByRole("button", { name: "Cancelar" }).click();
      await expect(trigger).toBeFocused(); expect(imageDeleteRequests).toHaveLength(0);
      await trigger.click(); await dialog.getByRole("button", { name: "Eliminar imagen", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(gallery.getByLabel("3 de 4 imágenes")).toBeVisible();
      await expect(gallery.getByRole("button", { name: "Arrastrar Vista 3 del monitor para ordenar" })).toBeFocused();
      await expect(page.getByText("Imagen eliminada correctamente.")).toBeVisible();
      await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Borrador conservado");
      expect(imageDeleteRequests).toHaveLength(1); expect(editorialRequests).toHaveLength(0);
      await expect(gallery.getByLabel("Archivo de imagen")).toBeEnabled();
      await expectAccessible(page); await expectNoPageOverflow(page);
    });

    test(`administrative image editing: ${theme}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
      const { imageEditRequests, editorialRequests } = await installCatalogApiFixture(page, "ADMIN", { galleryImageCount: 3 });
      await page.goto("/products");
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      const gallery = page.getByRole("region", { name: "Galería de imágenes" });
      const cards = gallery.getByRole("listitem");
      await expect(cards).toHaveCount(3);
      await page.getByLabel("Nombre", { exact: true }).fill("Borrador comercial");
      await gallery.getByRole("button", { name: "Editar descripción de Vista 2 del monitor" }).click();
      const alt = gallery.getByLabel("Texto alternativo", { exact: true });
      await expect(alt).toBeFocused();
      await alt.fill("Vista lateral del monitor"); await alt.press("Enter");
      await expect(gallery.getByRole("button", { name: "Editar descripción de Vista lateral del monitor" })).toBeVisible();
      await gallery.getByRole("button", { name: "Usar Vista lateral del monitor como portada" }).click();
      await expect(gallery.getByRole("button", { name: "Vista lateral del monitor es portada" })).toBeDisabled();
      await expect(gallery.getByText("Portada", { exact: true })).toHaveCount(1);
      const move = gallery.getByRole("button", { name: "Subir Vista 3 del monitor" });
      await move.focus(); await move.press("Enter");
      await expect(cards.nth(1)).toContainText("Vista 3 del monitor");
      const handle = gallery.getByRole("button", { name: "Arrastrar Vista 3 del monitor para ordenar" });
      await expect(handle).toBeFocused();
      if (width === 375) {
        // Mobile users have the same operation through compact touch/keyboard
        // controls, without dragging a card across a tall scrolling gallery.
        await gallery.getByRole("button", { name: "Subir Vista 3 del monitor" }).click();
      } else await handle.dragTo(cards.first());
      await expect(cards.first()).toContainText("Vista 3 del monitor");
      await expectAccessible(page); await expectNoPageOverflow(page);
      await gallery.screenshot({ path: `test-results/frontends/product-image-editing-${theme}-${width}.png` });
      expect(imageEditRequests.map((request) => request.input)).toEqual([{ altText: "Vista lateral del monitor" }, { isPrimary: true }, { sortOrder: 1 }, { sortOrder: 0 }]);
      await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Borrador comercial");
      await expect(page.getByLabel("URL de imagen", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Producto actualizado correctamente.")).toBeVisible();
      expect(editorialRequests).toHaveLength(1); expect(editorialRequests[0]).not.toHaveProperty("image");
      await page.reload(); await page.getByRole("button", { name: "Editar", exact: true }).click();
      await expect(cards.first()).toContainText("Vista 3 del monitor");
      await expect(gallery.getByRole("button", { name: "Vista lateral del monitor es portada" })).toBeDisabled();
    });
  }
  for (const width of [375, 1440]) {
    test(`administrative image upload: ${theme}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
      const { editorialRequests, imageUploadRequests } = await installCatalogApiFixture(page, "ADMIN");
      await page.goto("/products");
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      const gallery = page.getByRole("region", { name: "Galería de imágenes" });
      await expect(gallery.getByLabel("1 de 4 imágenes")).toBeVisible();
      await page.getByLabel("Nombre", { exact: true }).fill("Borrador de producto");
      await page.getByLabel("Archivo de imagen").setInputFiles({ name: "monitor.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1kAAAAASUVORK5CYII=", "base64") });
      await expect(page.getByLabel("Archivo de imagen")).toHaveValue(/monitor\.png$/);
      await expect(gallery.getByRole("img", { name: "Vista previa de la imagen seleccionada" })).toBeVisible();
      await page.getByLabel("Texto alternativo de la nueva imagen").fill("Monitor visto de lado");
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await gallery.screenshot({ path: `test-results/frontends/product-image-upload-${theme}-${width}.png` });
      await gallery.getByRole("button", { name: "Subir imagen", exact: true }).click();
      await expect(page.getByText("Imagen subida correctamente.")).toBeVisible();
      await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Borrador de producto");
      await expect(gallery.getByRole("img", { name: "Vista previa de la imagen seleccionada" })).toHaveCount(0);
      await expect(gallery.getByLabel("2 de 4 imágenes")).toBeVisible();
      expect(imageUploadRequests).toHaveLength(1);
      expect(imageUploadRequests[0]!.headers()["content-type"]).toBe("image/png");
      expect(imageUploadRequests[0]!.postDataBuffer()?.length).toBeGreaterThan(0);
      expect(new URL(imageUploadRequests[0]!.url()).searchParams.get("altText")).toBe("Monitor visto de lado");
      expect(editorialRequests).toHaveLength(0);
    });
  }
  for (const width of [375, 1440]) {
    test(`administrative gallery panel: ${theme}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
      await installCatalogApiFixture(page, "ADMIN", { galleryImageCount: 4 });
      await page.goto("/products");
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      const gallery = page.getByRole("region", { name: "Galería de imágenes" });
      await expect(gallery.getByLabel("4 de 4 imágenes")).toBeVisible();
      await expect(gallery.getByRole("listitem")).toHaveCount(4);
      await expect(gallery.getByText("Portada", { exact: true })).toHaveCount(1);
      await expect(gallery.getByText("Posición 4", { exact: true })).toBeVisible();
      const name = page.getByLabel("Nombre", { exact: true });
      await name.fill("Borrador conservado");
      await expect(name).toHaveValue("Borrador conservado");
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await gallery.screenshot({ path: `test-results/frontends/product-gallery-panel-${theme}-${width}.png` });
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`backoffice destaque list and form work with keyboard in ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
      const { editorialRequests } = await installCatalogApiFixture(page, "ADMIN");
      await page.goto("/products");
      const feature = page.getByRole("button", { name: "Destacar", exact: true });
      await expect(feature).toBeEnabled();
      await feature.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByText("Producto destacado correctamente.")).toBeVisible();
      await expect(page.getByText("Destacado", { exact: true })).toBeVisible();
      const selectedStar = page.getByRole("button", { name: "Retirar destaque", exact: true }).locator("svg");
      await expect(selectedStar).toHaveCSS("color", "rgb(202, 138, 4)");
      await expect(selectedStar).toHaveCSS("fill", "rgb(202, 138, 4)");
      expect(editorialRequests[0]).toEqual({ isFeatured: true });
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      const checkbox = page.getByRole("checkbox", { name: "Destacar producto" });
      await expect(checkbox).toBeChecked();
      await page.keyboard.press("Tab");
      await checkbox.focus();
      await expectVisibleKeyboardFocus(page);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.screenshot({ path: `test-results/frontends/destaque-form-${theme}-${width}.png`, fullPage: true });
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Producto actualizado correctamente.")).toBeVisible();
      expect(editorialRequests[1]).not.toHaveProperty("isFeatured");
      expect(editorialRequests[1]).not.toHaveProperty("featuredAt");
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      await checkbox.focus();
      await page.keyboard.press("Space");
      await expect(checkbox).not.toBeChecked();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Producto actualizado correctamente.")).toBeVisible();
      await expect(page.getByText("No destacado", { exact: true })).toBeVisible();
      expect(editorialRequests[2]).toMatchObject({ isFeatured: false });
      expect(editorialRequests[2]).not.toHaveProperty("featuredAt");
      await page.getByRole("button", { name: "Editar", exact: true }).click();
      await checkbox.check();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Producto actualizado correctamente.")).toBeVisible();
      await expect(page.getByText("Destacado", { exact: true })).toBeVisible();
      expect(editorialRequests[3]).toMatchObject({ isFeatured: true });
      expect(editorialRequests[3]).not.toHaveProperty("featuredAt");
      await page.screenshot({ path: `test-results/frontends/destaque-${theme}-${width}.png`, fullPage: true });
    });
  }
}

test("billing cannot access editorial product administration", async ({ page }) => {
  const { editorialRequests } = await installCatalogApiFixture(page, "BILLING");
  await page.goto("/products");
  await expect(page.getByRole("button", { name: "Destacar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
  expect(editorialRequests).toHaveLength(0);
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`important categories: selection, keyboard, drag, withdrawal and reload, ${theme}, ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
      const { categoryEditorialRequests } = await installCatalogApiFixture(page, "ADMIN", { editorialCategories: true });
      await page.goto("/categories");
      const panel = page.getByRole("region", { name: "Categorías importantes de la landing" });
      await expect(panel.getByText(/Configuración incompleta/)).toBeVisible();
      for (const name of ["Portátiles", "Monitores", "Periféricos"]) {
        await page.getByRole("button", { name: `Incluir ${name} en la landing` }).click();
        await expect(page.getByText("Categoría incluida en la landing.")).toBeVisible();
        await expect(panel.getByRole("button", { name: `Arrastrar ${name} para intercambiar posición` })).toBeEnabled();
      }
      await expect(panel.getByText("3/3 seleccionadas")).toBeVisible();
      await expect(page.getByRole("button", { name: "Incluir Audio en la landing" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Incluir Legado en la landing" })).toBeDisabled();
      await expect(panel.getByText(/Configuración incompleta/)).toHaveCount(0);
      const move = panel.getByRole("button", { name: "Subir Monitores" });
      await page.keyboard.press("Tab");
      await move.focus();
      await expectVisibleKeyboardFocus(page);
      await page.keyboard.press("Enter");
      const positions = panel.getByRole("listitem");
      await expect(positions.first()).toContainText("Monitores");
      await expect(panel.getByRole("button", { name: "Arrastrar Periféricos para intercambiar posición" })).toBeEnabled();
      await panel.getByRole("button", { name: "Arrastrar Periféricos para intercambiar posición" }).dragTo(positions.first());
      await expect(positions.first()).toContainText("Periféricos");
      expect(categoryEditorialRequests.slice(3).map((request) => request.input)).toEqual([{ landingOrder: 1 }, { landingOrder: 1 }]);
      await page.reload();
      await expect(positions.first()).toContainText("Periféricos");
      await expect(positions.nth(1)).toContainText("Portátiles");
      await expect(positions.nth(2)).toContainText("Monitores");
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await panel.screenshot({ path: `test-results/frontends/categories-${theme}-${width}.png` });
      await panel.getByRole("button", { name: "Retirar Monitores de la landing" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
      expect(categoryEditorialRequests).toHaveLength(5);
      await panel.getByRole("button", { name: "Retirar Monitores de la landing" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Retirar de la landing" }).click();
      await expect(panel.getByText("2/3 seleccionadas")).toBeVisible();
      await panel.getByRole("button", { name: "Retirar Portátiles de la landing" }).click();
      await expect(page.getByRole("dialog").getByText(/configuración quedará incompleta/)).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: "Retirar de la landing" }).click();
      await expect(panel.getByText(/Configuración incompleta/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Incluir Audio en la landing" })).toBeEnabled();
      expect(categoryEditorialRequests.at(-1)?.input).toEqual({ showOnLanding: false });
    });
  }
}

for (const role of ["BILLING", "CUSTOMER"] as const) {
  test(`important categories are not accessible to ${role}`, async ({ page }) => {
    const { categoryEditorialRequests } = await installCatalogApiFixture(page, role, { editorialCategories: true });
    await page.goto("/categories");
    await expect(page.locator('[data-slot="landing-categories"]')).toHaveCount(0);
    expect(categoryEditorialRequests).toHaveLength(0);
  });
}

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
