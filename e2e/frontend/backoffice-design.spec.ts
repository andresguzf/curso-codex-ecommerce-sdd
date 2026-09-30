import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoPageOverflow } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

for (const role of ["ADMIN", "BILLING"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [375, 1440]) {
      test(`administrative design: ${role}, ${theme}, ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await installCatalogApiFixture(page, role);
        await page.goto(role === "ADMIN" ? "/products" : "/orders");
        const surface = theme === "light" ? "rgb(255, 255, 255)" : "rgb(24, 34, 53)";
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const table = page.getByRole("table");
        await expect(table).toBeVisible();
        await expect(table.locator("tbody")).toHaveCSS("background-color", surface);
        await expect(table.locator("th").first()).toHaveCSS("font-size", "11px");
        await expect(table.locator("td").first()).toHaveCSS("padding-top", "8px");
        await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "24px");
        await expect(page.getByRole("button", { name: "Agregar al carrito" })).toHaveCount(0);
        await expectAccessible(page);
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath("list.png"), fullPage: true });
        if (role === "ADMIN") {
          await page.getByRole("button", { name: "+ Nuevo producto", exact: true }).click();
          await expect(page.getByRole("heading", { name: "Crear producto", exact: true })).toBeVisible();
          await expect(page.getByRole("textbox", { name: "Nombre", exact: true })).toHaveCSS("background-color", surface);
          await expectAccessible(page);
          await expectNoPageOverflow(page);
          await page.screenshot({ path: testInfo.outputPath("product-form.png"), fullPage: true });
          await page.getByRole("button", { name: "Cancelar", exact: true }).click();
          await page.getByRole("table").getByRole("link", { name: "Inventario", exact: true }).click();
          const metric = page.locator('[data-slot="metric-card"]');
          await expect(metric).toBeVisible();
          await expect(metric.getByText("14", { exact: true })).toBeVisible();
          await expect(metric).toHaveCSS("background-color", surface);
          await expectAccessible(page);
          await expectNoPageOverflow(page);
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: testInfo.outputPath("inventory.png"), fullPage: true });
        }
        if (width < 1024) await page.getByRole("button", { name: "Abrir navegación administrativa" }).click();
        const navigation = page.getByRole("navigation", { name: width < 1024 ? "Navegación administrativa móvil" : "Navegación administrativa", exact: true });
        if (role === "BILLING") {
          await expect(navigation.getByRole("link", { name: "Productos", exact: true })).toHaveCount(0);
          await expect(navigation.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
        }
        await navigation.getByRole("link", { name: "Facturas", exact: true }).click();
        await expect(page.getByText("1 facturas", { exact: true })).toBeVisible();
        await expect(page.getByRole("table").getByText("Borrador", { exact: true })).toBeVisible();
        await expectAccessible(page);
        await page.getByRole("button", { name: "Nueva factura manual" }).click();
        await expect(page.getByRole("heading", { name: "Factura manual", exact: true })).toBeVisible();
        const input = page.getByRole("combobox").first();
        await expect(input).toHaveCSS("background-color", surface);
        await expectAccessible(page);
        await expectNoPageOverflow(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: testInfo.outputPath("invoice-form.png"), fullPage: true });
      });
    }
  }
}
