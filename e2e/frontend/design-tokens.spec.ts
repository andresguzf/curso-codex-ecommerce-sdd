import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

import { expectAccessible, expectNoPageOverflow, expectVisibleKeyboardFocus } from "./accessibility-helpers";

async function openCatalog(page: Page) {
  const html = await readFile(resolve("docs/design-system.html"), "utf8");
  await page.setContent(html.replace(/<link[^>]+>/g, ""));
  for (const app of ["storefront", "backoffice"]) {
    const css = await readFile(resolve(`apps/${app}/src/styles/design-tokens.css`), "utf8");
    await page.addStyleTag({ content: css });
    expect(await readFile(resolve(`apps/${app}/src/app/globals.css`), "utf8"))
      .toContain('@import "../styles/design-tokens.css"');
  }
}

function contrast(first: string, second: string) {
  const luminance = (hex: string) => {
    expect(hex).toMatch(/^#[\da-f]{6}$/i);
    const channels = [1, 3, 5].map((start) => {
      const value = parseInt(hex.slice(start, start + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

for (const app of ["storefront", "backoffice"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test(`${app} ${theme}: complete semantic contract and contrast`, async ({ page }) => {
      await openCatalog(page);
      const panel = page.locator(`[data-design-system="${app}"][data-theme="${theme}"]`);
      const names = ["canvas", "surface", "surface-subtle", "text", "text-muted", "border", "accent", "accent-hover", "accent-text", "accent-soft", "focus", "success", "success-soft", "warning", "warning-soft", "danger", "danger-soft", "info", "info-soft", "disabled", "disabled-text", "elevation", "radius-panel", "radius-control", "space-unit", "space-panel", "space-control", "space-stack", "control-height", "row-height", "density", "font-body", "font-display", "font-data", "text-body", "text-title", "line-body"];
      names.push("inverse-surface", "inverse-subtle", "inverse-text", "inverse-muted", "inverse-border", "inverse-accent", "inverse-accent-hover", "inverse-accent-text");
      const tokens = await panel.evaluate((element, keys) => {
        const style = getComputedStyle(element);
        return Object.fromEntries(keys.map((key) => [key, style.getPropertyValue(`--ds-${key}`).trim()]));
      }, names);
      for (const name of names) expect(tokens[name], name).not.toBe("");
      const pairs = [["text", "canvas"], ["text", "surface"], ["text", "surface-subtle"], ["text-muted", "canvas"], ["text-muted", "surface"], ["accent-text", "accent"], ["accent-text", "accent-hover"], ["accent", "surface"], ["accent", "accent-soft"], ["success", "success-soft"], ["warning", "warning-soft"], ["danger", "danger-soft"], ["info", "info-soft"], ["disabled-text", "disabled"]];
      for (const surface of ["inverse-surface", "inverse-subtle"]) {
        pairs.push(["inverse-text", surface], ["inverse-muted", surface], ["inverse-accent", surface]);
        expect(contrast(tokens["inverse-border"]!, tokens[surface]!)).toBeGreaterThanOrEqual(3);
      }
      pairs.push(["inverse-accent-text", "inverse-accent"], ["inverse-accent-text", "inverse-accent-hover"]);
      for (const [foreground, background] of pairs) {
        expect(contrast(tokens[foreground!]!, tokens[background!]!), `${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const surface of ["canvas", "surface", "surface-subtle"]) {
        expect(contrast(tokens.focus!, tokens[surface]!)).toBeGreaterThanOrEqual(3);
        expect(contrast(tokens.border!, tokens[surface]!)).toBeGreaterThanOrEqual(3);
      }
      expect(tokens.density).toBe(app === "storefront" ? "comfortable" : "compact");
    });
  }
}

for (const width of [375, 1440]) {
  test(`catalogue: four independent previews, keyboard and responsive at ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await openCatalog(page);
    await expect(page.locator(".preview")).toHaveCount(4);
    await expectAccessible(page);
    await expectNoPageOverflow(page);
    await page.keyboard.press("Tab");
    await expectVisibleKeyboardFocus(page);
    const signatures = await page.locator(".preview").evaluateAll((elements) => elements.map((element) => {
      const style = getComputedStyle(element);
      return ["canvas", "accent", "radius-panel", "space-panel", "density"].map((name) => style.getPropertyValue(`--ds-${name}`).trim()).join("|");
    }));
    expect(new Set(signatures).size).toBe(4);
    await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`), fullPage: true });
  });
}

test("tokens remain opt-in and do not leak to existing screens", async ({ page }) => {
  await openCatalog(page);
  expect(await page.locator("body").evaluate((element) => getComputedStyle(element).getPropertyValue("--ds-canvas"))).toBe("");
  const roots = await page.locator(".preview").evaluateAll((elements) => elements.map((element) => ({
    app: element.getAttribute("data-design-system"),
    canvas: getComputedStyle(element).getPropertyValue("--ds-canvas"),
  })));
  expect(roots.filter((root) => root.app === "storefront").map((root) => root.canvas))
    .not.toEqual(roots.filter((root) => root.app === "backoffice").map((root) => root.canvas));
});
