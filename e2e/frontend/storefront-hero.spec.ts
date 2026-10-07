import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`panoramic hero: ${theme}, ${width}px, reduced motion`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await installCatalogApiFixture(page, "ANONYMOUS");
      await page.goto("/");
      const hero = page.locator('[data-slot="hero-showcase"]');
      await expect(hero).toHaveAttribute("data-reduced-motion", "true");
      await expect(hero).toHaveAttribute("data-running", "false");
      const first = hero.getByRole("img", { name: /Teclado mecánico/ });
      await expect.poll(() => first.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await expect(first).toHaveAttribute("loading", "eager");
      await expect(first).toHaveAttribute("fetchpriority", "high");
      await expect(first).toHaveCSS("animation-name", "none");
      await expect(hero.getByRole("button", { name: "Movimiento reducido: imágenes estáticas" })).toBeDisabled();
      const select = hero.getByRole("button", { name: "Mostrar Gráfica NVIDIA" });
      await select.focus();
      await expectVisibleKeyboardFocus(page);
      await page.keyboard.press("Enter");
      await expect(select).toBeFocused();
      await expect(hero).toHaveAttribute("data-active", "1");
      const second = hero.getByRole("img", { name: /Tarjeta gráfica/ });
      await expect.poll(() => second.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await expect(second).toHaveAttribute("loading", "lazy");
      await expect(hero.locator('[data-slot="hero-scene"][data-active="true"]')).toHaveCSS("transition-duration", "0s");
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await hero.getByRole("button", { name: "Mostrar Teclado RGB" }).click();
      await page.mouse.move(0, 0);
      await page.evaluate(() => { (document.activeElement as HTMLElement)?.blur(); window.scrollTo(0, 0); });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: testInfo.outputPath("landing.png"), fullPage: true });
      await page.getByRole("searchbox", { name: "Buscar en el catálogo" }).fill("monitor");
      await page.getByRole("button", { name: "Buscar productos" }).click();
      await expect(page).toHaveURL(/\/products\?page=1&search=monitor/);
      await expect(page.getByRole("heading", { name: "Encuentra el equipo que va contigo." })).toBeVisible();
    });
  }
}

test("hero autoplay, pause, interaction and live reduced motion", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installCatalogApiFixture(page, "ANONYMOUS");
  await page.goto("/");
  const hero = page.locator('[data-slot="hero-showcase"]');
  await expect(hero.locator('[data-loaded="true"]')).toHaveCount(2);
  await page.mouse.move(0, 0);
  await expect(hero).toHaveAttribute("data-running", "true");
  await expect(hero.locator("img").first()).toHaveCSS("animation-play-state", "running");
  await page.clock.runFor(14_050);
  await expect(hero).toHaveAttribute("data-active", "1");
  await hero.getByRole("button", { name: "Pausar movimiento del hero" }).click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.clock.fastForward(28_000);
  await expect(hero).toHaveAttribute("data-active", "1");
  await expect(hero).toHaveAttribute("data-paused", "true");
  await hero.getByRole("button", { name: "Reanudar movimiento del hero" }).click();
  await page.mouse.move(0, 0);
  await page.getByRole("searchbox", { name: "Buscar en el catálogo" }).focus();
  await expect(hero).toHaveAttribute("data-running", "false");
  await page.clock.fastForward(28_000);
  await expect(hero).toHaveAttribute("data-active", "1");
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await expect(hero).toHaveAttribute("data-running", "true");
  await hero.hover();
  await expect(hero).toHaveAttribute("data-running", "false");
  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(hero).toHaveAttribute("data-running", "false");
  await expect(hero.locator("img").first()).toHaveCSS("animation-name", "none");
});

test("hero without JavaScript preserves a static photo and native GET search", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: "http://localhost:3000" });
  try {
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const photo = page.locator('[data-slot="hero-showcase"] img').first();
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('[data-slot="hero-showcase"]')).toHaveAttribute("data-running", "false");
    await page.getByRole("searchbox", { name: "Buscar en el catálogo" }).fill("monitor");
    await page.getByRole("button", { name: "Buscar productos" }).click();
    await expect(page).toHaveURL(/\/products\?page=1&search=monitor/);
  } finally { await context.close(); }
});

test("hero failed images preserve frame and usable search", async ({ page }) => {
  await installCatalogApiFixture(page, "ANONYMOUS");
  await page.route("**/_next/image?*", (route) => {
    if (new URL(route.request().url()).searchParams.get("url")?.includes("hero-")) return route.abort();
    return route.continue();
  });
  await page.goto("/");
  const hero = page.locator('[data-slot="hero-showcase"]');
  await expect(hero.locator("img")).toHaveCount(0);
  await expect(hero.locator(".hero-fallback")).toBeVisible();
  await hero.getByRole("button", { name: "Mostrar Gráfica NVIDIA" }).click();
  await expect(hero.locator("img")).toHaveCount(0);
  await expect(hero).toHaveAttribute("data-running", "false");
  await page.getByRole("searchbox", { name: "Buscar en el catálogo" }).fill("monitor");
  await page.getByRole("button", { name: "Buscar productos" }).click();
  await expect(page).toHaveURL(/search=monitor/);
});
