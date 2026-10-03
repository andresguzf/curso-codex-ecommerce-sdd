import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { productDetailSchema, productGalleryImageSchema } from "@technology-ecommerce/api-schemas";
import { imageBytes } from "./cloudinary-image-fixture";

const api = "http://localhost:3101/api/v1";
const diagnostics = "http://localhost:3101/__e2e/cloudinary";
const password = "InvoiceBrowserPassword123!";
async function authorization(request: APIRequestContext, role = "admin") {
  const login = await request.post(`${api}/auth/login`, { data: { email: `${role}@invoice.example.test`, password } });
  expect(login.status()).toBe(200);
  return { Authorization: `Bearer ${(await login.json()).accessToken}` };
}
async function createProduct(request: APIRequestContext, headers: Record<string, string>, name: string, image = { storageKey: `external/demo/${name}`, url: "https://picsum.photos/id/60/800/600.webp" }) {
  const category = await request.post(`${api}/categories`, { headers, data: { name, status: "ACTIVE" } });
  expect(category.status()).toBe(201);
  const response = await request.post(`${api}/products`, { headers, data: { sku: name, name, categoryId: (await category.json()).id, image: { storageKey: image.storageKey, url: image.url }, description: "Isolated Cloudinary test", price: "10.00", status: "ACTIVE" } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}
async function deliverControlledImages(page: Page, request: APIRequestContext) {
  async function media(source: string) {
    const stats = await (await request.get(diagnostics)).json();
    const asset = stats.assets.find((entry: { secure_url: string }) => entry.secure_url === source);
    return asset ? request.get(`${diagnostics}/media/${asset.asset_id}`) : null;
  }
  await page.route("https://res.cloudinary.com/browser-test/**", async (route) => {
    const response = await media(route.request().url());
    if (response) await route.fulfill({ response }); else await route.abort();
  });
  await page.route("**/_next/image?*", async (route) => {
    const source = new URL(route.request().url()).searchParams.get("url") ?? "";
    const response = await media(source);
    if (response) await route.fulfill({ response });
    else if (source.startsWith("https://picsum.photos/")) await route.fulfill({ status: 200, contentType: "image/png", body: imageBytes });
    else await route.continue();
  });
  await page.route("https://picsum.photos/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: imageBytes }));
}

test.afterEach(async ({ page, request }) => {
  await page.unrouteAll({ behavior: "wait" });
  await request.post(`${diagnostics}/control`, { data: { mode: "ok" } });
});

for (const theme of ["light", "dark"] as const) for (const width of [375, 1440]) {
  test(`Cloudinary real REST gallery ${theme} ${width}`, async ({ page, request }) => {
    const headers = await authorization(request);
    const name = `Cloud-${theme}-${width}`;
    const product = await createProduct(request, headers, name);
    const original = productDetailSchema.parse(await (await request.get(`${api}/products/${product.id}?view=administrative`, { headers })).json());
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.addInitScript((value) => localStorage.setItem("technology-ecommerce:backoffice:theme", value), theme);
    await deliverControlledImages(page, request);
    await page.goto("/login"); await page.getByLabel("Correo").fill("admin@invoice.example.test");
    await page.getByLabel("Contraseña").fill(password); await page.getByRole("button", { name: "Entrar al panel" }).click();
    await expect(page).not.toHaveURL(/login/);
    await page.goto(`/products?search=${name}`); await page.getByRole("button", { name: "Editar", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const panel = page.getByRole("region", { name: "Galería de imágenes" });
    await page.getByLabel("Nombre", { exact: true }).fill("Unchanged commercial draft");
    await panel.getByLabel("Archivo de imagen").setInputFiles({ name: "cloud.png", mimeType: "image/png", buffer: imageBytes });
    await panel.getByLabel("Texto alternativo de la nueva imagen").fill("Cloud cover");
    await panel.getByRole("button", { name: "Subir imagen", exact: true }).click();
    await expect(panel.getByLabel("2 de 4 imágenes")).toBeVisible();
    await expect.poll(() => panel.getByRole("img", { name: "Cloud cover", exact: true }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await panel.getByRole("button", { name: "Usar Cloud cover como portada" }).click();
    await expect(panel.getByRole("button", { name: "Cloud cover es portada" })).toBeDisabled();
    const detail = productDetailSchema.parse(await (await request.get(`${api}/products/${product.id}?view=administrative`, { headers })).json());
    expect(detail.images.find((image) => image.id === original.coverImage!.id)).toMatchObject({ url: original.coverImage!.url, altText: original.coverImage!.altText });
    expect(detail.coverImage!.storageKey).toMatch(/^cloudinary:v1:browser-test:/);
    const stats = await (await request.get(diagnostics)).json();
    expect(stats.uploads.every((upload: { folder: string; overwrite: boolean }) => upload.folder === "codex-storefront" && !upload.overwrite)).toBe(true);
    await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Unchanged commercial draft");
    await page.goto(`http://localhost:3100/products?search=${name}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const card = page.getByRole("img", { name, exact: true }); await card.scrollIntoViewIfNeeded();
    await expect.poll(() => card.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await page.goto(`http://localhost:3100/products/${product.id}`);
    const gallery = page.getByRole("region", { name: `Imágenes de ${name}` });
    await expect(gallery.getByRole("button", { name: /Ver imagen/ })).toHaveCount(2);
    const stage = gallery.locator('[data-slot="gallery-stage"]'); await stage.focus(); await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight");
    await expect(gallery.getByRole("status")).toHaveText("Imagen 2 de 2");
    await expect(stage).toBeFocused();
    // Removing a referenced active cover is forbidden. Restore the legacy
    // cover first; then cleanup affects only the newly uploaded cloud asset.
    expect((await request.delete(`${api}/products/${product.id}/images/${detail.coverImage!.id}`, { headers })).status()).toBe(409);
    expect((await request.patch(`${api}/products/${product.id}/images/${original.coverImage!.id}`, { headers, data: { isPrimary: true } })).status()).toBe(200);
    expect((await request.delete(`${api}/products/${product.id}/images/${detail.coverImage!.id}`, { headers })).status()).toBe(204);
    await request.post(`${diagnostics}/reconcile`);
    const finalDetail = productDetailSchema.parse(await (await request.get(`${api}/products/${product.id}?view=administrative`, { headers })).json());
    expect(finalDetail.images).toHaveLength(1);
    expect(finalDetail.coverImage).toMatchObject({ id: original.coverImage!.id, url: original.coverImage!.url });
    const afterCleanup = await (await request.get(diagnostics)).json();
    expect(afterCleanup.assets.some((asset: { secure_url: string }) => asset.secure_url === detail.coverImage!.url)).toBe(false);
  });
}

test("real REST permissions, mixed local/Picsum/cloud, contention and compensation", async ({ request }) => {
  const headers = await authorization(request);
  const { localImage } = await (await request.get(diagnostics)).json();
  const product = await createProduct(request, headers, "Cloud-contention", localImage);
  const upload = () => request.post(`${api}/products/${product.id}/images?altText=remote`, { headers: { ...headers, "Content-Type": "image/png" }, data: imageBytes });
  const initial = await (await request.get(diagnostics)).json();
  for (const role of [null, "billing", "customer"]) {
    const restricted = role ? await authorization(request, role) : {};
    expect((await request.post(`${api}/products/${product.id}/images?altText=forbidden`, { headers: { ...restricted, "Content-Type": "image/png" }, data: imageBytes })).status()).toBe(role ? 403 : 401);
  }
  expect((await (await request.get(diagnostics)).json()).uploads).toHaveLength(initial.uploads.length);
  for (let index = 0; index < 2; index++) expect((await upload()).status()).toBe(201);
  await request.post(`${diagnostics}/control`, { data: { mode: "barrier" } });
  const results = await Promise.all([upload(), upload()]);
  expect(results.map((response) => response.status()).sort()).toEqual([201, 409]);
  expect(await results.find((response) => response.status() === 409)!.json()).toMatchObject({ code: "PRODUCT_IMAGE_LIMIT_REACHED" });
  const detail = productDetailSchema.parse(await (await request.get(`${api}/products/${product.id}?view=administrative`, { headers })).json());
  expect(detail.images).toHaveLength(4); expect(detail.images.filter((image) => image.isPrimary)).toHaveLength(1);
  expect(detail.coverImage).toMatchObject({ storageKey: localImage.storageKey, url: localImage.url });
  await request.post(`${diagnostics}/reconcile`);
  const after = await (await request.get(diagnostics)).json();
  expect(after.deleted.length).toBe(initial.deleted.length + 1);
  expect((await request.get(localImage.url.replace("localhost:3001", "localhost:3101"))).status()).toBe(200);
});

test("real UI accepted timeout preserves draft, does not reupload and reconciles orphan", async ({ page, request }) => {
  const headers = await authorization(request);
  const product = await createProduct(request, headers, "Cloud-uncertain");
  const before = await (await request.get(diagnostics)).json();
  await page.goto("/login"); await page.getByLabel("Correo").fill("admin@invoice.example.test");
  await page.getByLabel("Contraseña").fill(password); await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(page).not.toHaveURL(/login/);
  await page.goto(`/products?search=${product.name}`); await page.getByRole("button", { name: "Editar", exact: true }).click();
  const panel = page.getByRole("region", { name: "Galería de imágenes" });
  await page.getByLabel("Nombre", { exact: true }).fill("Draft after timeout");
  await request.post(`${diagnostics}/control`, { data: { mode: "timeout" } });
  await panel.getByLabel("Archivo de imagen").setInputFiles({ name: "cloud.png", mimeType: "image/png", buffer: imageBytes });
  await panel.getByLabel("Texto alternativo de la nueva imagen").fill("Uncertain asset");
  await panel.getByRole("button", { name: "Subir imagen", exact: true }).click();
  await expect(page.getByText("No pudimos completar la operación de imágenes. Actualiza la galería antes de reintentar.")).toBeVisible();
  await expect(panel.getByLabel("1 de 4 imágenes")).toBeVisible();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Draft after timeout");
  await expect(panel.getByRole("button", { name: "Subir imagen", exact: true })).toBeEnabled();
  await page.waitForTimeout(1200);
  const uncertain = await (await request.get(diagnostics)).json();
  expect(uncertain.uploads).toHaveLength(before.uploads.length + 1);
  expect(uncertain.assets).toHaveLength(before.assets.length + 1);
  await request.post(`${diagnostics}/reconcile`);
  expect((await (await request.get(diagnostics)).json()).assets).toHaveLength(before.assets.length);
  const explicit = await request.post(`${api}/products/${product.id}/images?altText=Explicit`, { headers: { ...headers, "Content-Type": "image/png" }, data: imageBytes });
  expect(explicit.status()).toBe(201); productGalleryImageSchema.parse(await explicit.json());
});
