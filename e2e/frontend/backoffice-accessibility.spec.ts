import { expect, test } from "@playwright/test";

import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

for (const role of ["ADMIN", "BILLING"] as const) {
  for (const width of [320, 375, 768, 1440]) {
    test(`accessibility backoffice navigation ${role} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await installCatalogApiFixture(page, role);
      await page.goto(role === "ADMIN" ? "/products" : "/");
      await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
      await expectVisibleKeyboardFocus(page);
      await page.keyboard.press("Enter");
      await expect(page.locator("#backoffice-main-content")).toBeFocused();
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      if (width < 1024) {
        const opener = page.getByRole("button", { name: "Abrir navegación administrativa" });
        await opener.press("Enter");
        await expect(page.getByRole("navigation", { name: "Navegación administrativa móvil" })).toBeVisible();
        await expectAccessible(page);
        await expectNoPageOverflow(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath("navigation.png"), fullPage: true });
        await page.keyboard.press("Escape");
        await expect(opener).toBeFocused();
      } else {
        const toggle = page.getByRole("button", { name: "Contraer navegación lateral" });
        await toggle.press("Enter");
        await expect(page.getByRole("button", { name: "Expandir navegación lateral" })).toBeFocused();
        await expectAccessible(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath("navigation.png"), fullPage: true });
      }
    });
  }
}

for (const width of [375, 1440]) {
  test(`accessibility backoffice filters, confirmation and flash at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await installCatalogApiFixture(page, "ADMIN");
    await page.goto("/products");
    await expect(page.getByText("37 productos", { exact: true })).toBeVisible();
    const filtersOpener = page.getByRole("button", { name: "Mostrar filtros" });
    await filtersOpener.press("Enter");
    await expectAccessible(page);
    await expectNoPageOverflow(page);
    await page.keyboard.press("Escape");
    await expect(filtersOpener).toBeFocused();
    const opener = page.getByRole("button", { name: "Eliminar", exact: true });
    await opener.press("Enter");
    const dialog = page.getByRole("dialog", { name: "¿Eliminar este producto?" });
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await expectAccessible(page);
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Eliminar producto" })).toBeFocused();
    await expectVisibleKeyboardFocus(page);
    await page.keyboard.press("Enter");
    await expect(page.locator('[aria-live="polite"]').filter({ hasText: "Producto eliminado lógicamente." })).toBeVisible();
    await expectAccessible(page);
    await expectNoPageOverflow(page);
    await page.getByRole("button", { name: "Cerrar aviso" }).click();
    fixture.failProductDeletion();
    await opener.press("Enter");
    await page.getByRole("button", { name: "Eliminar producto" }).press("Enter");
    await expect(page.locator('[aria-live="assertive"] [data-tone="error"]')).toBeVisible();
    await expectAccessible(page);
  });
}
