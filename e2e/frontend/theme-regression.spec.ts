import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";
import { installCatalogApiFixture } from "./catalog-api-fixture";

async function expectVisualBaseline(page: Page, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
    window.scrollTo(0, 0);
  });
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    // Ignore only Next's development tooling, never application content.
    stylePath: resolve("e2e/screenshot.css"),
    maxDiffPixels: 0,
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [375, 1440]) {
    test(`theme regression: ${theme}, ${width}px`, async ({ page }, testInfo) => {
      const application = testInfo.project.name === "backoffice" ? "backoffice" : "storefront";
      const key = `technology-ecommerce:${application}:theme`;
      const otherKey = `technology-ecommerce:${application === "storefront" ? "backoffice" : "storefront"}:theme`;
      const opposite = theme === "light" ? "dark" : "light";
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await installCatalogApiFixture(page, application === "backoffice" ? "ADMIN" : "ANONYMOUS");
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          if (!document.body) return;
          document.documentElement.dataset.firstBodyTheme = document.documentElement.dataset.theme ?? "missing";
          observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      await page.goto(application === "backoffice" ? "/" : "/products");
      await expect(page.locator(application === "backoffice" ? '[data-slot="dashboard"] dd' : '[data-slot="product-card"]')).not.toHaveCount(0);
      const toggle = page.getByRole("button", { name: "Tema oscuro", exact: true });
      await expect(toggle).toBeEnabled();
      await expect(toggle.locator(`[data-theme-icon="${theme === "dark" ? "sun" : "moon"}"] svg`)).toBeVisible();
      await expect(toggle).toHaveText("");
      await expect(page.locator("html")).toHaveAttribute("data-first-body-theme", theme);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await expectVisualBaseline(page, `${application}-${theme}-${width}-workspace.png`);

      // Follow the system until a keyboard selection establishes a preference.
      await page.emulateMedia({ colorScheme: opposite });
      await expect(page.locator("html")).toHaveAttribute("data-theme", opposite);
      await toggle.focus();
      await expectVisibleKeyboardFocus(page);
      await page.keyboard.press("Space");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(toggle).toBeFocused();
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(theme);
      await page.evaluate(({ storageKey, value }) => localStorage.setItem(storageKey, value), { storageKey: otherKey, value: opposite });
      await page.reload();
      await expect(toggle).toBeEnabled();
      await expect(page.locator("html")).toHaveAttribute("data-first-body-theme", theme);
      await expect(toggle).toHaveAttribute("aria-pressed", String(theme === "dark"));
      await expect(toggle.locator(`[data-theme-icon="${theme === "dark" ? "sun" : "moon"}"] svg`)).toBeVisible();
      await page.emulateMedia({ colorScheme: theme });
      await page.emulateMedia({ colorScheme: opposite });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), otherKey)).toBe(opposite);

      if (application === "backoffice") {
        await page.goto("/products");
        await expect(page.getByRole("table")).toBeVisible();
      } else {
        await page.getByRole("link", { name: "Ver detalle de Monitor Nova 27" }).click();
        await expect(page.locator('[data-slot="product-detail"]')).toBeVisible();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectAccessible(page);
      await expectNoPageOverflow(page);
      await expectVisualBaseline(page, `${application}-${theme}-${width}-content.png`);
    });
  }
}
