import { expect, test, type Page } from "@playwright/test";

const api = "http://localhost:3101/api/v1";
const password = "InvoiceBrowserPassword123!";

async function login(page: Page, role: "ADMIN" | "BILLING") {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(`${role.toLowerCase()}@invoice.example.test`);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto("/invoices");
  await expect(page.getByRole("heading", { name: "Facturas", exact: true })).toBeVisible();
}

for (const role of ["ADMIN", "BILLING"] as const) {
  test(`${role} searches remotely, selects with keyboard and persists a manual invoice`, async ({ page }) => {
    const searches: URL[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.searchParams.get("purpose") === "autocomplete") searches.push(url);
    });
    await login(page, role);
    await page.getByRole("button", { name: "Nueva factura manual" }).click();
    const customer = page.getByRole("combobox", { name: "Cliente", exact: true });
    await customer.fill("Cl");
    await expect(page.getByText("Escribe al menos 3 caracteres para buscar.").first()).toBeVisible();
    expect(searches).toHaveLength(0);
    const customerResponse = page.waitForResponse((response) => response.url().startsWith(`${api}/users?`) && new URL(response.url()).searchParams.get("search") === "Cliente Demo");
    await customer.fill("Cliente Demo");
    const customerPage = await (await customerResponse).json();
    expect(customerPage).toMatchObject({ page: 1, pageSize: 20, totalItems: 25 });
    expect(customerPage.items).toHaveLength(20);
    await expect(page.getByRole("option").first()).toContainText("Cliente Demo 01");
    await customer.press("ArrowDown");
    await expect(customer).toHaveAttribute("aria-activedescendant", /option-0$/);
    await customer.press("Enter");
    await expect(page.getByRole("button", { name: "Cambiar cliente" })).toBeFocused();

    const product = page.getByRole("combobox", { name: "Producto (opcional)" });
    const productResponse = page.waitForResponse((response) => response.url().startsWith(`${api}/products?`) && new URL(response.url()).searchParams.get("search") === "Teclado Demo");
    await product.fill("Teclado Demo");
    const productPage = await (await productResponse).json();
    expect(productPage).toMatchObject({ page: 1, pageSize: 20, totalItems: 25 });
    await expect(page.getByRole("option").first()).toContainText("Teclado Demo 01");
    await product.press("ArrowDown");
    await product.press("Enter");
    await expect(page.getByLabel("Precio unitario (USD)")).toHaveValue("89.50");
    await page.getByLabel("Cantidad").fill("2");
    await page.getByLabel("Impuesto", { exact: true }).fill("19.0000");

    const creation = page.waitForResponse((response) => response.url() === `${api}/invoices` && response.request().method() === "POST");
    await page.getByRole("button", { name: "Crear factura manual" }).click();
    const response = await creation;
    expect(response.status()).toBe(201);
    const sent = response.request().postDataJSON();
    expect(sent).toEqual({ customerId: customerPage.items[0].id, shippingTotal: "0.00", lines: [{ productId: productPage.items[0].id, quantity: 2, unitPrice: "89.50", taxRate: "19.0000" }] });
    const invoice = await response.json();
    expect(invoice).toMatchObject({ origin: "MANUAL", status: "DRAFT", orderId: null, subtotal: "179.00", taxTotal: "34.01", total: "213.01" });
    await expect(page.getByText("Factura manual creada como borrador.")).toBeVisible();
    await page.goto(`/invoices/${invoice.id}`);
    await expect(page.getByText("Teclado Demo 01", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Teclado Demo 01", { exact: true })).toBeVisible();
    for (const url of searches) {
      expect(url.searchParams.get("page")).toBe("1");
      expect(url.searchParams.get("pageSize")).toBe("20");
      expect(url.searchParams.get("search")!.length).toBeGreaterThanOrEqual(3);
    }
  });
}

test("anonymous and CUSTOMER requests cannot lookup clients/products or create invoices", async ({ page, request }) => {
  const payload = { customerId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", lines: [{ name: "Forbidden", description: "Forbidden", quantity: 1, unitPrice: "10.00", taxRate: "0.0000" }] };
  const session = await request.post(`${api}/auth/login`, { data: { email: "customer@invoice.example.test", password } });
  expect(session.status()).toBe(200);
  const { accessToken } = await session.json();
  const authorizationCases: Record<string, string>[] = [{}, { Authorization: `Bearer ${accessToken}` }];
  for (const headers of authorizationCases) {
    const expectedStatus = "Authorization" in headers ? 403 : 401;
    for (const resource of ["users", "products"]) {
      const response = await request.get(`${api}/${resource}?purpose=autocomplete&search=Demo&pageSize=20`, { headers });
      expect(response.status()).toBe(expectedStatus);
      expect(await response.json()).not.toHaveProperty("items");
    }
    expect((await request.post(`${api}/invoices`, { headers, data: payload })).status()).toBe(expectedStatus);
  }
  await page.goto("/invoices");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Nueva factura manual" })).toHaveCount(0);
});
