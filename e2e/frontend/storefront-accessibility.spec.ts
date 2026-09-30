import { expect, test } from "@playwright/test";

import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

for (const width of [320, 375, 768, 1440]) {
  test(`accessibility storefront shell, hero and filters at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installCatalogApiFixture(page, "ANONYMOUS");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "El equipo correcto cambia tu ritmo." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Monitor Nova 27", exact: true })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
    await expectVisibleKeyboardFocus(page);
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    const headingBox = await page.getByRole("heading", { name: "El equipo correcto cambia tu ritmo." }).boundingBox();
    const headerBox = await page.getByRole("banner").boundingBox();
    expect(headingBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
    await expectAccessible(page);
    await expectNoPageOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("landing.png"), fullPage: true });
    await page.getByRole("searchbox", { name: "Buscar en el catálogo" }).fill("monitor");
    await page.getByRole("searchbox", { name: "Buscar en el catálogo" }).press("Enter");
    await expect(page).toHaveURL(/\/products\?.*search=monitor/);
    await expect(page.getByRole("heading", { name: "Encuentra el equipo que va contigo." })).toBeVisible();
    await expectAccessible(page);
    await expectNoPageOverflow(page);
    if (width < 1024) {
      const opener = page.getByRole("button", { name: "Filtros", exact: true });
      await opener.focus();
      await page.keyboard.press("Enter");
      const drawer = page.getByRole("dialog", { name: "Filtros del catálogo" });
      await expect(drawer.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
      await expectAccessible(page);
      await expect(drawer).toHaveCSS("animation-name", "none");
      await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
      await expect(page.locator("#main-content").locator("xpath=ancestor::*[@inert]")).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath("filters.png") });
      await page.keyboard.press("Shift+Tab");
      await expect(drawer.getByRole("button", { name: "Limpiar", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(drawer.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
      await expect(opener).toBeFocused();
      await opener.press("Enter");
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(drawer).not.toBeVisible();
      await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    } else {
      await page.getByRole("button", { name: "Ocultar filtros del catálogo" }).press("Enter");
      await expect(page.getByRole("button", { name: "Mostrar filtros del catálogo" })).toBeFocused();
      await page.getByRole("button", { name: "Mostrar filtros del catálogo" }).press("Enter");
      await expect(page.getByRole("button", { name: "Ocultar filtros del catálogo" })).toBeFocused();
    }
  });
}

test("accessibility storefront cart modal and live feedback", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installCatalogApiFixture(page, "CUSTOMER");
  await page.goto("/cart");
  const opener = page.getByRole("button", { name: "Quitar Monitor Nova 27 del carrito" });
  await expect(opener).toBeVisible();
  await expectAccessible(page);
  await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: "¿Quitar este producto?" });
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await expectAccessible(page);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.abs(box!.y + box!.height / 2 - 406)).toBeLessThan(2);
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Quitar producto" })).toBeFocused();
  await expectVisibleKeyboardFocus(page);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await opener.press("Enter");
  await dialog.getByRole("button", { name: "Quitar producto" }).press("Enter");
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: "Producto eliminado del carrito." })).toBeVisible();
  await expectAccessible(page);
  await expectNoPageOverflow(page);
});
