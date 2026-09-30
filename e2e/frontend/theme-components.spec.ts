import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoPageOverflow } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

for (const theme of ["light", "dark"] as const) {
  test(`theme component states: modal and flash, ${theme}`, async ({ page }, testInfo) => {
    const admin = testInfo.project.name === "backoffice";
    await page.setViewportSize({ width: 375, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await installCatalogApiFixture(page, admin ? "ADMIN" : "CUSTOMER");
    await page.goto(admin ? "/products" : "/cart");
    const opener = page.getByRole("button", { name: admin ? "Eliminar" : "Quitar Monitor Nova 27 del carrito", exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: admin ? "¿Eliminar este producto?" : "¿Quitar este producto?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await expectAccessible(page);
    await page.screenshot({ path: testInfo.outputPath("modal-before.png") });
    const nextTheme = theme === "light" ? "dark" : "light";
    await page.emulateMedia({ colorScheme: nextTheme });
    await expect(page.locator("html")).toHaveAttribute("data-theme", nextTheme);
    await expect(dialog).toHaveCSS("background-color", admin
      ? nextTheme === "dark" ? "rgb(24, 34, 53)" : "rgb(255, 255, 255)"
      : nextTheme === "dark" ? "rgb(18, 45, 70)" : "rgb(255, 255, 255)");
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await expectAccessible(page);
    await dialog.getByRole("button", { name: admin ? "Eliminar producto" : "Quitar producto", exact: true }).click();
    const flash = page.locator('[data-slot="flash-message"]');
    await expect(flash).toBeVisible();
    await expect(flash).toContainText("Hecho");
    await expect(flash).toHaveCSS("background-color", admin
      ? nextTheme === "dark" ? "rgb(24, 34, 53)" : "rgb(255, 255, 255)"
      : nextTheme === "dark" ? "rgb(18, 45, 70)" : "rgb(255, 255, 255)");
    await expectAccessible(page);
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("flash-after.png"), fullPage: true });
  });

  test(`theme component states: form validation, ${theme}`, async ({ page }, testInfo) => {
    const admin = testInfo.project.name === "backoffice";
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await installCatalogApiFixture(page, "ANONYMOUS");
    await page.goto("/login");
    const email = page.getByRole("textbox", { name: admin ? "Correo corporativo" : "Correo electrónico" });
    await expect(email).toBeVisible();
    await expect(email).toHaveCSS("background-color", admin
      ? theme === "dark" ? "rgb(24, 34, 53)" : "rgb(255, 255, 255)"
      : theme === "dark" ? "rgb(18, 45, 70)" : "rgb(255, 255, 255)");
    await page.getByRole("button", { name: admin ? "Entrar al panel" : "Iniciar sesión", exact: true }).click();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expectAccessible(page);
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("invalid-form.png"), fullPage: true });
  });
}
