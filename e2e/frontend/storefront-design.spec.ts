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
      const surface = theme === "light" ? "rgb(255, 255, 255)" : "rgb(28, 23, 38)";
      await expect(card).toHaveCSS("background-color", surface);
      await expect(card).toHaveCSS("box-shadow", "none");
      await expect(card.locator('[data-tone-region="inverse"]')).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("body")).toHaveCSS("font-family", /Source Sans 3 Variable/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-family", /Space Grotesk Variable/);
      const loadedFonts = await page.evaluate(() => Array.from(document.fonts)
        .filter((font) => font.status === "loaded").map((font) => font.family));
      expect(loadedFonts).toContainEqual(expect.stringContaining("Source Sans 3 Variable"));
      expect(loadedFonts).toContainEqual(expect.stringContaining("Space Grotesk Variable"));
      const fontUrls = await page.evaluate(() => performance.getEntriesByType("resource")
        .map((entry) => entry.name).filter((url) => /\.woff2(?:\?|$)/.test(url)));
      expect(fontUrls.length).toBeGreaterThanOrEqual(2);
      for (const url of fontUrls) expect(new URL(url).origin).toBe(new URL(page.url()).origin);
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
      await expect(page.getByRole("navigation", { name: "Paginación del catálogo" }).getByRole("button", { name: "Página 1, actual" })).toHaveCSS("min-height", "44px");
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

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`catalog visual states and unavailable stock: ${theme}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await installCatalogApiFixture(page, "ANONYMOUS", { stockAvailable: 0, galleryImageCount: 3 });
      const headers = { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" };
      let state: "empty" | "error" | "ready" = "empty";
      let release: () => void = () => {};
      const pending = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/api/v1/products?**", async (route) => {
        if (route.request().method() !== "GET" || state === "ready") { await route.fallback(); return; }
        await pending;
        await route.fulfill(state === "empty"
          ? { headers, json: { items: [], page: 1, pageSize: 12, totalItems: 0, totalPages: 0 } }
          : { headers, status: 500, json: { code: "INTERNAL_ERROR", message: "Fixture error", correlationId: "catalog-design" } });
      });
      await page.goto("/products");
      await expect(page.getByText("Cargando productos…")).toBeVisible();
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      release();
      await expect(page.getByRole("heading", { name: "No encontramos productos" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Paginación del catálogo" })).toHaveCount(0);
      await expectAccessible(page);
      await page.screenshot({ path: testInfo.outputPath("catalog-empty.png"), fullPage: true });
      state = "error";
      await page.getByRole("searchbox", { name: "Buscar en todos los productos" }).fill("error");
      await page.getByRole("button", { name: "Buscar", exact: true }).click();
      await expect(page.getByText("No pudimos cargar el catálogo. Comprueba la conexión e inténtalo nuevamente.")).toBeVisible();
      await expectAccessible(page);
      await page.screenshot({ path: testInfo.outputPath("catalog-error.png"), fullPage: true });
      state = "ready";
      await page.getByRole("button", { name: "Intentar nuevamente" }).click();
      const card = page.locator('[data-slot="product-card"]');
      await expect(card.getByText("Agotado", { exact: true })).toBeVisible();
      await expect(card.getByRole("button", { name: "Agregar Monitor Nova 27 al carrito" })).toBeDisabled();
      await expect(card.getByText("$299.90")).toBeVisible();
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await card.getByRole("link", { name: "Ver detalle de Monitor Nova 27" }).click();
      await expect(page.getByRole("button", { name: "Agregar Monitor Nova 27 al carrito" })).toBeDisabled();
      await expect(page.getByText("Producto sin stock", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Imagen siguiente" })).toBeEnabled();
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("detail-out-of-stock.png"), fullPage: true });
    });

    test(`detail visual states: ${theme}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await installCatalogApiFixture(page, "ANONYMOUS");
      let state: "error" | "missing" | "ready" = "error";
      let release: () => void = () => {};
      const pending = new Promise<void>((resolve) => { release = resolve; });
      await page.route("**/api/v1/products/10184fd0-3dcb-47cf-af70-a8be4c765421?**", async (route) => {
        if (route.request().method() !== "GET" || state === "ready") { await route.fallback(); return; }
        await pending;
        await route.fulfill({
          headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" },
          status: state === "missing" ? 404 : 500,
          json: { code: state === "missing" ? "PRODUCT_NOT_FOUND" : "INTERNAL_ERROR", message: "Fixture error", correlationId: "detail-design" },
        });
      });
      await page.goto("/products/10184fd0-3dcb-47cf-af70-a8be4c765421");
      await expect(page.getByText("Cargando detalle del producto…")).toBeVisible();
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      release();
      await expect(page.getByText("Comprueba que la API esté disponible y vuelve a intentarlo.")).toBeVisible();
      await expectAccessible(page);
      await page.screenshot({ path: testInfo.outputPath("detail-error.png"), fullPage: true });
      state = "missing";
      await page.getByRole("button", { name: "Intentar nuevamente" }).click();
      await expect(page.getByRole("heading", { name: "Producto no disponible" })).toBeVisible();
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("detail-unavailable.png"), fullPage: true });
      state = "ready";
      await page.reload();
      await expect(page.getByRole("heading", { name: "Monitor Nova 27" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Agregar Monitor Nova 27 al carrito" })).toBeEnabled();
    });
  }
}
