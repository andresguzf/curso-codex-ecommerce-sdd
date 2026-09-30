import { expect, type Page } from "@playwright/test";
import axe from "axe-core";

/** Real-browser WCAG AA checks, including computed text/background contrast. */
export async function expectAccessible(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const engine = (window as typeof window & { axe: typeof axe }).axe;
    const result = await engine.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    });
    return result.violations.map(({ id, nodes }) => ({
      id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }));
  });
  expect(violations).toEqual([]);
}

export async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

export async function expectVisibleKeyboardFocus(page: Page) {
  expect(await page.evaluate(() => {
    const element = document.activeElement;
    if (!element || !element.matches(":focus-visible")) return false;
    const style = getComputedStyle(element);
    return (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== "none";
  })).toBe(true);
}
