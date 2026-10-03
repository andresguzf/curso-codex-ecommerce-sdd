import { expect, test } from "@playwright/test";
import { installCatalogApiFixture } from "./catalog-api-fixture";
import { catalogCloudUrl, imageBytes, installCloudImageDelivery } from "./cloudinary-image-fixture";
import { expectNoPageOverflow } from "./accessibility-helpers";

for (const theme of ["light", "dark"] as const) for (const width of [375, 1440]) {
  test(`cloud admin delivery and uncertain upload: ${theme}, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
    const fixture = await installCatalogApiFixture(page, "ADMIN", { galleryImageCount: 3, galleryImageUrl: catalogCloudUrl, imageUploadTimeout: true });
    await installCloudImageDelivery(page);
    await page.goto("/products");
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    const gallery = page.getByRole("region", { name: "Galería de imágenes" });
    const thumbnail = gallery.getByRole("img", { name: "Vista 1 del monitor", exact: true });
    await expect(thumbnail).toHaveAttribute("src", catalogCloudUrl);
    await expect.poll(() => thumbnail.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.getByLabel("Nombre", { exact: true }).fill("Borrador conservado Cloudinary");
    await gallery.getByLabel("Archivo de imagen").setInputFiles({ name: "temporary.png", mimeType: "image/png", buffer: imageBytes });
    await gallery.getByLabel("Texto alternativo de la nueva imagen", { exact: true }).fill("Imagen temporal");
    await gallery.getByRole("button", { name: "Subir imagen", exact: true }).click();
    await expect.poll(() => fixture.imageUploadRequests.length).toBe(1);
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Borrador conservado Cloudinary");
    await expect(gallery.getByLabel("3 de 4 imágenes")).toBeVisible();
    await expect(gallery.getByRole("button", { name: "Subir imagen", exact: true })).toBeEnabled();
    await page.waitForTimeout(1200);
    expect(fixture.imageUploadRequests).toHaveLength(1);
    expect(fixture.editorialRequests).toHaveLength(0);
    await expectNoPageOverflow(page);
  });
}

test("cloud admin delivery: failed thumbnail keeps the accessible fallback", async ({ page }) => {
  await installCatalogApiFixture(page, "ADMIN", { galleryImageCount: 3, galleryImageUrl: catalogCloudUrl });
  await installCloudImageDelivery(page, true);
  await page.goto("/products");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const gallery = page.getByRole("region", { name: "Galería de imágenes" });
  await expect(gallery.getByRole("img", { name: "Vista 1 del monitor", exact: true })).toHaveText("Imagen no disponible");
});
