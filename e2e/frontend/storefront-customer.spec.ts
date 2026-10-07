import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";
import { customerDocumentId, installCustomerApiFixture } from "./customer-api-fixture";

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`customer visual journey: ${theme}, ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await installCustomerApiFixture(page);
      for (const [path, ready] of [
        ["/account", "Cliente de Prueba"],
        ["/account/wishlist", "Tus deseos, a mano."],
        ["/account/orders", "Mis compras"],
        [`/account/orders/${customerDocumentId}`, "Detalle de tu pedido"],
        ["/account/invoices", "Mis facturas"],
        [`/account/invoices/${customerDocumentId}`, "Detalle de factura"],
      ]) {
        await page.goto(path!);
        await expect(page.getByRole("heading", { name: ready!, exact: true })).toBeVisible();
        if (path!.includes(customerDocumentId)) {
          await expect(page.getByText("Teclado histórico", { exact: true })).toBeVisible();
          await expect(page.getByText("$205.00", { exact: true })).toBeVisible();
          await expect(page.getByText("Nombre histórico", { exact: true })).toBeVisible();
          await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeVisible();
          await expect(page.getByRole("button", { name: /facturar|anular|cancelar orden/i })).toHaveCount(0);
        }
        if (path === "/account/wishlist") await expect(page.getByText("Monitor Nova 27", { exact: true })).toBeVisible();
        await expectAccessible(page);
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath(`${path!.replaceAll("/", "-")}.png`), fullPage: true });
      }
      await page.goto("/cart");
      const summary = page.locator('[data-slot="purchase-summary"]');
      await expect(summary.getByText("$299.90", { exact: true })).toHaveCount(2);
      await page.getByRole("button", { name: "Aumentar cantidad de Monitor Nova 27" }).click();
      await expect(summary.getByText("$599.80", { exact: true })).toHaveCount(2);
      await expect(page.locator('[data-slot="flash-message"]')).toBeVisible();
      await page.getByRole("button", { name: "Cerrar aviso" }).click();
      const remove = page.getByRole("button", { name: "Quitar Monitor Nova 27 del carrito" });
      await remove.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("cart-dialog.png") });
      await page.keyboard.press("Escape");
      await expect(remove).toBeFocused();
      await expectVisibleKeyboardFocus(page);
      await expect(summary.getByText("$599.80", { exact: true })).toHaveCount(2);
      await expectAccessible(page);
      await page.screenshot({ path: testInfo.outputPath("cart.png"), fullPage: true });
    });

    test(`customer list and detail pending empty error states: ${theme}, ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      const fixture = await installCustomerApiFixture(page);
      for (const [path, endpoint, loading, empty] of [
        ["/account/orders", "/api/v1/orders/mine", "Cargando tus compras…", "Tu primera compra empieza en la tienda"],
        ["/account/invoices", "/api/v1/invoices", "Cargando tus facturas…", "Aún no tienes facturas"],
        ["/account/wishlist", "/api/v1/wishlist", "Cargando tus deseos…", "Todavía no guardaste productos"],
      ]) {
        let release: () => void = () => {};
        const pending = new Promise<void>((resolve) => { release = resolve; });
        await page.route(`http://localhost:3001${endpoint}*`, async (route) => {
          if (route.request().method() === "GET") await pending;
          await route.fallback();
        });
        fixture.state.documents = "empty";
        await page.goto(path!);
        await expect(page.getByText(loading!, { exact: true })).toBeVisible();
        await expectAccessible(page);
        release();
        await expect(page.getByRole("heading", { name: empty!, exact: true })).toBeVisible();
        await expectAccessible(page);
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath(`${endpoint!.split("/").at(-1)}-empty.png`), fullPage: true });
        fixture.state.documents = "error";
        await page.reload();
        await expect(page.getByRole("alert")).toBeVisible();
        await expectAccessible(page);
        await expectNoPageOverflow(page);
      }
      for (const path of [`/account/orders/${customerDocumentId}`, `/account/invoices/${customerDocumentId}`]) {
        await page.goto(path);
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectAccessible(page);
        await expectNoPageOverflow(page);
        await page.screenshot({ path: testInfo.outputPath(`${path.includes("invoices") ? "invoice" : "order"}-error.png`), fullPage: true });
      }
    });

    test(`customer forms preserve drafts and checkout feedback: ${theme}, ${width}px`, async ({ page }, testInfo) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await installCatalogApiFixture(page, "ANONYMOUS");
      for (const path of ["/login", "/register"]) {
        await page.goto(path);
        await page.getByLabel("Correo electrónico", { exact: true }).fill("demo@example.test");
        await page.getByLabel("Contraseña", { exact: true }).fill("demo-password-123");
        if (path === "/register") await page.getByLabel("Nombre", { exact: true }).fill("Borrador cliente");
        await page.getByRole("button", { name: "Tema oscuro" }).click();
        await expect(page.getByLabel("Correo electrónico", { exact: true })).toHaveValue("demo@example.test");
        await expect(page.getByLabel("Contraseña", { exact: true })).toHaveValue("demo-password-123");
        if (path === "/register") await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Borrador cliente");
        await expect(page.locator('[data-tone-region="inverse"]')).toHaveCount(0);
        await expectAccessible(page);
        await expectNoPageOverflow(page);
        await page.getByRole("button", { name: "Tema oscuro" }).click();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expectAccessible(page);
        await page.screenshot({ path: testInfo.outputPath(`${path.slice(1)}.png`), fullPage: true });
      }
      const fixture = await installCustomerApiFixture(page);
      await page.goto("/checkout");
      await expect(page.getByLabel("Dirección", { exact: true })).toBeVisible();
      await page.getByLabel("Dirección", { exact: true }).fill("Calle Demo 123");
      await page.getByLabel("Ciudad", { exact: true }).fill("Santiago");
      await page.getByLabel("Región o estado", { exact: true }).fill("RM");
      await page.getByLabel("Código postal", { exact: true }).fill("8320000");
      await page.getByRole("radio", { name: /Envío estándar/ }).check();
      const summary = page.locator('[data-slot="purchase-summary"]');
      await expect(summary.getByText("$304.90", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Tema oscuro" }).click();
      await expect(page.getByLabel("Dirección", { exact: true })).toHaveValue("Calle Demo 123");
      await expect(page.getByRole("radio", { name: /Envío estándar/ })).toBeChecked();
      await expect(summary.getByText("$304.90", { exact: true })).toBeVisible();
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.getByRole("button", { name: "Tema oscuro" }).click();
      await page.screenshot({ path: testInfo.outputPath("checkout.png"), fullPage: true });
      await page.getByRole("radio", { name: "Tarjeta ficticia · rechazar pago" }).check();
      await page.getByRole("button", { name: "Confirmar compra simulada" }).click();
      await expect(page.getByText("El pago simulado fue rechazado. Elige otro método e inténtalo nuevamente.")).toBeVisible();
      await expect(page.getByLabel("Dirección", { exact: true })).toHaveValue("Calle Demo 123");
      await expectAccessible(page);
      await page.screenshot({ path: testInfo.outputPath("checkout-rejected.png"), fullPage: true });
      await page.getByRole("radio", { name: "Tarjeta ficticia · aprobar pago" }).check();
      let release: () => void = () => {};
      fixture.state.checkoutPending = new Promise<void>((resolve) => { release = resolve; });
      await page.getByRole("button", { name: "Confirmar compra simulada" }).click();
      await expect(page.getByRole("button", { name: "Confirmando…" })).toBeDisabled();
      await expect(page.getByLabel("Dirección", { exact: true })).toBeDisabled();
      await expectAccessible(page);
      release();
      await expect(page.getByRole("heading", { name: "Tu pedido está en proceso" })).toBeVisible();
      await expect(page.getByText("$304.90", { exact: true })).toBeVisible();
      expect(fixture.checkoutRequests).toHaveLength(2);
      for (const request of fixture.checkoutRequests) expect(request.key).toMatch(/^[0-9a-f-]{36}$/);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("receipt.png"), fullPage: true });
    });
  }
}
