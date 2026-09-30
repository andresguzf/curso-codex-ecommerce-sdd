import { expect, test } from "@playwright/test";
import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

for (const role of ["ADMIN", "BILLING"] as const) {
  for (const theme of ["light", "dark"] as const) {
    for (const width of [375, 1440]) {
      test(`dashboard: ${role}, ${theme}, ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await installCatalogApiFixture(page, role);
        const requests: string[] = [];
        // React Strict Mode can cancel the first development request on remount.
        // Count completed aggregate responses, not the aborted probe.
        page.on("response", (response) => {
          if (response.status() === 200 && response.request().method() === "GET" && response.url().endsWith("/api/v1/dashboard/summary")) requests.push(response.url());
        });
        await page.goto("/");
        const dashboard = page.locator('[data-slot="dashboard"]');
        await expect(dashboard.getByRole("heading", { name: "Indicadores de gestión" })).toBeVisible();
        await expect(dashboard.locator("dd").filter({ hasText: role === "ADMIN" ? /^21$/ : /^7$/ })).toBeVisible();
        await expect(dashboard.locator('[data-slot="metric-card"]')).toHaveCount(role === "ADMIN" ? 5 : 4);
        expect(requests).toHaveLength(1);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(dashboard.locator('[data-slot="metric-card"]').first()).toHaveCSS("background-color", theme === "dark" ? "rgb(24, 34, 53)" : "rgb(255, 255, 255)");
        await expectAccessible(page);
        await expectNoPageOverflow(page);
        const refresh = dashboard.getByRole("button", { name: "Actualizar resumen" });
        await refresh.focus();
        await page.keyboard.press("Tab");
        await expectVisibleKeyboardFocus(page);
        await refresh.click();
        await expect(refresh).toBeEnabled();
        await expect.poll(() => requests.length).toBe(2);
        if (role === "BILLING") {
          for (const path of ["/users", "/products", "/inventory"]) await expect(dashboard.locator(`a[href^="${path}"]`)).toHaveCount(0);
          await expect(dashboard.locator("time")).toHaveCount(3);
        }
        await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
        await dashboard.getByRole("link", { name: role === "ADMIN" ? "Consultar órdenes en proceso" : "Consultar órdenes por facturar" }).click();
        await expect(page).toHaveURL(/\/orders\?page=1&status=PROCESSING/);
        if (role === "BILLING") await expect(page).toHaveURL(/invoicing=NO_ACTIVE_INVOICE/);
        await expect(page.getByRole("table")).toBeVisible();
      });
    }
  }
}
