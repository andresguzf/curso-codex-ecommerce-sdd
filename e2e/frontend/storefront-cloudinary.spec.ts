import { expect, test } from "@playwright/test";
import { installCatalogApiFixture } from "./catalog-api-fixture";
import { catalogCloudUrl, installCloudImageDelivery } from "./cloudinary-image-fixture";
import { expectNoPageOverflow } from "./accessibility-helpers";

for (const theme of ["light", "dark"] as const) for (const width of [375, 1440]) {
  test(`cloud catalog delivery: ${theme}, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await installCatalogApiFixture(page, "ANONYMOUS", { galleryImageCount: 3, galleryImageUrl: catalogCloudUrl });
    await installCloudImageDelivery(page);
    await page.goto("/products");
    const cover = page.getByRole("img", { name: "Monitor Nova 27", exact: true });
    await expect(cover).toBeVisible();
    await cover.scrollIntoViewIfNeeded();
    await expect(cover).toHaveAttribute("src", new RegExp(encodeURIComponent(catalogCloudUrl)));
    await expect.poll(() => cover.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.goto("/products/10184fd0-3dcb-47cf-af70-a8be4c765421");
    const gallery = page.getByRole("region", { name: "Imágenes de Monitor Nova 27" });
    const detailImage = gallery.getByRole("img", { name: "Vista 1 del monitor", exact: true });
    await expect.poll(() => detailImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await gallery.getByRole("button", { name: "Imagen siguiente" }).click();
    await expect(gallery.getByRole("button", { name: "Imagen siguiente" })).toBeFocused();
    await expect(gallery.getByRole("status")).toHaveText("Imagen 2 de 3");
    await gallery.locator('[data-slot="gallery-stage"]').focus();
    await page.keyboard.press("Home");
    await expect(gallery.getByRole("status")).toHaveText("Imagen 1 de 3");
    await expectNoPageOverflow(page);
  });
}

test("cloud catalog delivery: failure uses the existing placeholder", async ({ page }) => {
  await installCatalogApiFixture(page, "ANONYMOUS", { galleryImageCount: 3, galleryImageUrl: catalogCloudUrl });
  await installCloudImageDelivery(page, true);
  await page.goto("/products/10184fd0-3dcb-47cf-af70-a8be4c765421");
  await expect(page.getByRole("img", { name: "Vista 1 del monitor" })).toHaveAttribute("src", "/images/product-placeholder.svg");
});
