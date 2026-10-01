import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoPageOverflow } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`commercial storefront: ${theme}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await installCatalogApiFixture(page, "ANONYMOUS");
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const navigation = page.getByRole("navigation", { name: "Navegación principal" });
      await expect(navigation.getByRole("link", { name: "Inicio", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(navigation.getByRole("link", { name: "Productos", exact: true })).not.toHaveAttribute("aria-current");
      const card = page.locator('[data-slot="product-card"]');
      await expect(card).toBeVisible();
      await expect(card.getByRole("img", { name: "Monitor Nova 27" })).toBeVisible();
      await expect(card.getByText("$299.90")).toBeVisible();
      await expect(card.getByRole("button", { name: "Agregar Monitor Nova 27 al carrito" })).toBeEnabled();
      const surface = theme === "light" ? "rgb(255, 255, 255)" : "rgb(18, 45, 70)";
      await expect(card).toHaveCSS("background-color", surface);
      await expect(page.getByRole("table")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: /administración|backoffice/i })).toHaveCount(0);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      const navbar = page.locator('[data-slot="storefront-header"]');
      await expect(navbar).toHaveAttribute("data-scrolled", "false");
      const initialBackground = await navbar.evaluate((element) => getComputedStyle(element).backgroundColor);
      await page.evaluate(() => window.scrollTo(0, 350));
      await expect(navbar).toHaveAttribute("data-scrolled", "true");
      await expect.poll(() => navbar.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(initialBackground);
      await expect.poll(() => navbar.evaluate((element) => getComputedStyle(element).backgroundColor)).toContain("0.82");
      expect(await navbar.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
      await expectAccessible(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(navbar).toHaveAttribute("data-scrolled", "false");
      await page.screenshot({ path: testInfo.outputPath("landing.png"), fullPage: true });
      await page.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Productos", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Encuentra el equipo que va contigo." })).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Productos", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(navigation.getByRole("link", { name: "Inicio", exact: true })).not.toHaveAttribute("aria-current");
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      if (width < 1024) {
        await page.getByRole("button", { name: "Filtros", exact: true }).click();
        await expectAccessible(page);
        await page.screenshot({ path: testInfo.outputPath("filters.png") });
        await page.keyboard.press("Escape");
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("catalog.png"), fullPage: true });
      await page.getByRole("link", { name: "Ver detalle de Monitor Nova 27" }).click();
      const detail = page.locator('[data-slot="product-detail"]');
      await expect(detail.getByRole("heading", { name: "Monitor Nova 27" })).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Productos", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(detail.getByText("14 unidades disponibles")).toBeVisible();
      await expect(detail.getByRole("button", { name: "Agregar Monitor Nova 27 al carrito" })).toBeEnabled();
      await expect(detail).toHaveCSS("background-color", surface);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath("detail.png"), fullPage: true });
    });
  }
}
