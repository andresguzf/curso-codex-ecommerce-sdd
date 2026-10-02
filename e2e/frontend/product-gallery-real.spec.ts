import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoPageOverflow } from "./accessibility-helpers";

const api = "http://localhost:3101/api/v1";
const password = "InvoiceBrowserPassword123!";
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNQCl2FFTEMpAQAyAc2MfMTc90AAAAASUVORK5CYII=", "base64");

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
});

for (const theme of ["light", "dark"] as const) for (const width of [375, 1440]) {
  test(`real gallery lifecycle ${theme} ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
    const login = await request.post(`${api}/auth/login`, { data: { email: "admin@invoice.example.test", password } });
    expect(login.status()).toBe(200);
    const { accessToken } = await login.json(); const headers = { Authorization: `Bearer ${accessToken}` };
    const name = `Galería ${theme} ${width}`;
    const category = await (await request.post(`${api}/categories`, { headers, data: { name, status: "ACTIVE" } })).json();
    const created = await request.post(`${api}/products`, { headers, data: { sku: `GAL-${theme}-${width}`, name, categoryId: category.id, image: { storageKey: `defaults/gallery-${theme}-${width}`, url: "/images/product-placeholder.svg" }, description: "Producto temporal de validación", price: "49.00", status: "ACTIVE" } });
    expect(created.status(), await created.text()).toBe(201); const product = await created.json();
    // Forward only media bytes to the isolated storage, never REST responses.
    await page.route("http://localhost:3001/api/v1/media/images/**", async (route) => {
      const media = await request.get(route.request().url().replace("localhost:3001", "localhost:3101"));
      await route.fulfill({ response: media });
    });
    await page.goto("/login"); await page.getByLabel("Correo").fill("admin@invoice.example.test");
    await page.getByLabel("Contraseña").fill(password); await page.getByRole("button", { name: "Entrar al panel" }).click();
    await expect(page).not.toHaveURL(/login/);
    await page.goto(`/products?search=${encodeURIComponent(name)}`);
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    const panel = page.getByRole("region", { name: "Galería de imágenes" });
    await expect(panel.getByLabel("1 de 4 imágenes")).toBeVisible();
    await page.getByLabel("Nombre", { exact: true }).fill("Borrador no guardado");
    for (let index = 1; index <= 3; index++) {
      await panel.getByLabel("Archivo de imagen").setInputFiles({ name: "image.png", mimeType: "image/png", buffer: bytes });
      await panel.getByLabel("Texto alternativo de la nueva imagen").fill(`Vista real ${index}`);
      await panel.getByRole("button", { name: "Subir imagen", exact: true }).click();
      await expect(panel.getByLabel(`${index + 1} de 4 imágenes`)).toBeVisible();
      await expect.poll(() => panel.getByRole("img", { name: `Vista real ${index}`, exact: true }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    }
    await expect(panel.getByLabel("Archivo de imagen")).toBeDisabled();
    const fifth = await request.post(`${api}/products/${product.id}/images?altText=Quinta`, { headers: { ...headers, "Content-Type": "image/png" }, data: bytes });
    expect(fifth.status()).toBe(409); expect(await fifth.json()).toMatchObject({ code: "PRODUCT_IMAGE_LIMIT_REACHED" });
    await panel.getByRole("button", { name: "Usar Vista real 1 como portada" }).click();
    await expect(panel.getByRole("button", { name: "Vista real 1 es portada" })).toBeDisabled();
    const up = panel.getByRole("button", { name: "Subir Vista real 3" }); await up.focus(); await up.press("Enter");
    await expect(panel.getByRole("button", { name: "Arrastrar Vista real 3 para ordenar" })).toBeFocused();
    await panel.getByRole("button", { name: "Editar descripción de Vista real 2" }).click();
    await panel.getByLabel("Texto alternativo", { exact: true }).fill("Vista editada"); await panel.getByLabel("Texto alternativo", { exact: true }).press("Enter");
    const trash = panel.getByRole("button", { name: "Eliminar Vista editada" }); await trash.click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click(); await expect(trash).toBeFocused();
    await trash.click(); await page.getByRole("dialog").getByRole("button", { name: "Eliminar imagen", exact: true }).click();
    await expect(panel.getByLabel("3 de 4 imágenes")).toBeVisible();
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Borrador no guardado");
    await expectAccessible(page); await expectNoPageOverflow(page);
    await panel.screenshot({ path: `test-results/gallery-real/admin-${theme}-${width}.png` });
    const detail = await (await request.get(`${api}/products/${product.id}?view=administrative`, { headers })).json();
    expect(detail.images).toHaveLength(3); expect(detail.images.filter((image: { isPrimary: boolean }) => image.isPrimary)).toHaveLength(1);
    expect((await request.delete(`${api}/products/${product.id}/images/${detail.coverImage.id}`, { headers })).status()).toBe(409);
    expect((await request.get(detail.coverImage.url.replace("localhost:3001", "localhost:3101"))).status()).toBe(200);
    await page.reload(); await page.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(panel.getByLabel("3 de 4 imágenes")).toBeVisible(); await expect(panel.getByRole("button", { name: "Vista real 1 es portada" })).toBeDisabled();
    const publicDetail = await (await request.get(`${api}/products/slug/${product.slug}`)).json();
    expect(publicDetail.images).toEqual(detail.images); expect(publicDetail.coverImage.id).toBe(detail.coverImage.id);
    // Only the image transport is forwarded to the isolated API. REST/catalog
    // responses and all mutations are real; no fixture route supplies data.
    await page.route("**/_next/image?*", async (route) => {
      const source = new URL(route.request().url()).searchParams.get("url");
      if (!source?.startsWith("http://localhost:3001/api/v1/media/images/")) { await route.continue(); return; }
      const media = await request.get(source.replace("localhost:3001", "localhost:3101"));
      await route.fulfill({ response: media });
    });
    await page.goto(`http://localhost:3100/products?search=${encodeURIComponent(name)}`);
    const cardImage = page.getByRole("img", { name, exact: true });
    await expect(cardImage).toBeVisible();
    await expect(cardImage).toHaveAttribute("src", new RegExp(encodeURIComponent(detail.coverImage.storageKey)));
    await expect.poll(() => cardImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await page.goto(`http://localhost:3100/products/${product.id}`);
    const gallery = page.getByRole("region", { name: `Imágenes de ${name}` });
    await expect(gallery.getByRole("button", { name: /Ver imagen/ })).toHaveCount(3);
    await gallery.getByRole("button", { name: "Imagen siguiente" }).click();
    await expectNoPageOverflow(page);
  });
}

test("real image mutations reject anonymous, Billing and Customer", async ({ request }) => {
  const admin = await (await request.post(`${api}/auth/login`, { data: { email: "admin@invoice.example.test", password } })).json();
  const headers = { Authorization: `Bearer ${admin.accessToken}` };
  const category = await (await request.post(`${api}/categories`, { headers, data: { name: "Permisos galería", status: "ACTIVE" } })).json();
  const created = await request.post(`${api}/products`, { headers, data: { sku: "GAL-PERMISSIONS", categoryId: category.id, image: { storageKey: "defaults/gallery-permissions", url: "/images/product-placeholder.svg" }, name: "Permisos galería", description: "Prueba", price: "1.00", status: "ACTIVE" } });
  expect(created.status(), await created.text()).toBe(201); const product = await created.json();
  const detail = await (await request.get(`${api}/products/${product.id}?view=administrative`, { headers })).json();
  for (const role of [null, "billing", "customer"]) {
    const token = role ? (await (await request.post(`${api}/auth/login`, { data: { email: `${role}@invoice.example.test`, password } })).json()).accessToken : null;
    const authorization: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const status = token ? 403 : 401;
    expect((await request.post(`${api}/products/${product.id}/images?altText=Forbidden`, { headers: { ...authorization, "Content-Type": "image/png" }, data: bytes })).status()).toBe(status);
    expect((await request.patch(`${api}/products/${product.id}/images/${detail.coverImage.id}`, { headers: authorization, data: { altText: "Forbidden" } })).status()).toBe(status);
    expect((await request.delete(`${api}/products/${product.id}/images/${detail.coverImage.id}`, { headers: authorization })).status()).toBe(status);
  }
});
