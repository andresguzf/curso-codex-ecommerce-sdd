import { expect, test } from "@playwright/test";
import { installCatalogApiFixture } from "./catalog-api-fixture";

export function themeScenarios(application: "storefront" | "backoffice") {
  const key = `technology-ecommerce:${application}:theme`;
  test(`${application}: system preference before body, persistence and client navigation`, async ({ page }) => {
    await installCatalogApiFixture(page, application === "storefront" ? "ANONYMOUS" : "ADMIN");
    await page.emulateMedia({ colorScheme: "dark" });
    const errors: string[] = [];
    page.on("console", (message) => { if (/hydration|did not match/i.test(message.text())) errors.push(message.text()); });
    await page.addInitScript(() => {
      const observer = new MutationObserver(() => {
        if (!document.body) return;
        document.documentElement.dataset.firstBodyTheme = document.documentElement.dataset.theme ?? "missing";
        observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    await page.goto("/products");
    await expect(page.locator("html")).toHaveAttribute("data-first-body-theme", "dark");
    const toggle = page.getByRole("button", { name: "Tema oscuro", exact: true });
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe("light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-first-body-theme", "light");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("link", { name: "Inicio", exact: true }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(errors).toEqual([]);
  });
  test(`${application}: no saved preference follows system and foreign preference is ignored`, async ({ page }) => {
    await installCatalogApiFixture(page, "ANONYMOUS");
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Tema oscuro", exact: true })).toBeEnabled();
    await page.evaluate((other) => localStorage.setItem(`technology-ecommerce:${other}:theme`, "dark"), application === "storefront" ? "backoffice" : "storefront");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const toggle = page.getByRole("button", { name: "Tema oscuro", exact: true });
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.emulateMedia({ colorScheme: "light" });
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
}
