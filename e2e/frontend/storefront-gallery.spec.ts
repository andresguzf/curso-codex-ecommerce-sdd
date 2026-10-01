import { expect, test } from "@playwright/test";

import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

const detailUrl = "/products/10184fd0-3dcb-47cf-af70-a8be4c765421";

test("product gallery: failed image falls back without layout shift or product mutation", async ({ page }) => {
  await installCatalogApiFixture(page, "ANONYMOUS", { galleryImageCount: 3, galleryImageUrl: "/images/missing-gallery-test.svg" });
  await page.route("**/images/missing-gallery-test.svg", (route) => route.fulfill({ status: 404, body: "Not found" }));
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/products") && request.method() !== "GET" && request.method() !== "OPTIONS") mutations.push(request.url());
  });
  await page.goto(detailUrl);
  const gallery = page.getByRole("region", { name: "Imágenes de Monitor Nova 27" });
  const image = gallery.getByRole("img", { name: "Vista 1 del monitor" });
  await expect(image).toHaveAttribute("src", "/images/product-placeholder.svg");
  const stage = gallery.locator('[data-slot="gallery-stage"]');
  const before = await stage.boundingBox();
  await gallery.getByRole("button", { name: "Imagen siguiente" }).click();
  await expect(gallery.getByRole("img", { name: "Vista 2 del monitor" })).toHaveAttribute("src", "/images/product-placeholder.svg");
  const after = await stage.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  expect(mutations).toEqual([]);
  await page.reload();
  await expect(gallery.getByRole("status")).toHaveText("Imagen 1 de 3");
  await expectAccessible(page);
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`product gallery: manual navigation, ${theme}, ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await installCatalogApiFixture(page, "ANONYMOUS", { galleryImageCount: 3 });
      await page.goto(detailUrl);
      const gallery = page.getByRole("region", { name: "Imágenes de Monitor Nova 27" });
      const stage = gallery.locator('[data-slot="gallery-stage"]');
      await expect(gallery.getByRole("status")).toHaveText("Imagen 1 de 3");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const initial = await stage.boundingBox();
      await gallery.getByRole("button", { name: "Imagen siguiente" }).click();
      await expect(gallery.getByRole("button", { name: "Imagen siguiente" })).toBeFocused();
      await expect(gallery.getByRole("img", { name: "Vista 2 del monitor" })).toBeVisible();
      await expect(gallery.getByRole("img", { name: "Vista 2 del monitor" })).toHaveAttribute("loading", "lazy");
      await gallery.getByRole("button", { name: "Ver imagen 3: Vista 3 del monitor" }).click();
      await page.keyboard.press("ArrowLeft");
      await expect(gallery.getByRole("button", { name: "Ver imagen 2: Vista 2 del monitor" })).toBeFocused();
      await stage.focus();
      await page.keyboard.press("Home");
      await page.keyboard.press("ArrowLeft");
      await expect(gallery.getByRole("status")).toHaveText("Imagen 3 de 3");
      await expect(stage).toBeFocused();
      await expectVisibleKeyboardFocus(page);
      await page.keyboard.press("Home");
      await stage.evaluate((element) => {
        const start = new Touch({ identifier: 1, target: element, clientX: 250, clientY: 150 });
        const end = new Touch({ identifier: 1, target: element, clientX: 100, clientY: 155 });
        element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [start] }));
        element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, changedTouches: [end] }));
      });
      await expect(gallery.getByRole("status")).toHaveText("Imagen 2 de 3");
      // No timers or automatic advancement: the selected slide stays selected.
      await page.waitForTimeout(1100);
      await expect(gallery.getByRole("status")).toHaveText("Imagen 2 de 3");
      const after = await stage.boundingBox();
      expect(after?.width).toBe(initial?.width);
      expect(after?.height).toBe(initial?.height);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`gallery-${theme}-${width}.png`), fullPage: true });
    });
  }

  test(`product gallery: one image without misleading controls, ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await installCatalogApiFixture(page, "ANONYMOUS", { galleryImageCount: 1 });
    await page.goto(detailUrl);
    const gallery = page.getByRole("region", { name: "Imágenes de Monitor Nova 27" });
    await expect(gallery.getByRole("img", { name: "Vista 1 del monitor" })).toBeVisible();
    await expect(gallery.getByRole("button")).toHaveCount(0);
    await expect(gallery.getByRole("status")).toHaveCount(0);
    await expectAccessible(page);
  });
}
