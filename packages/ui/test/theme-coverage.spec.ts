import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const coverage = readFileSync(resolve(root, "packages/ui/src/theme-coverage.css"), "utf8");
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

describe("complete application theme coverage", () => {
  it("maps every legacy palette utility in both apps and shared components to semantic tokens", () => {
    const missing = new Set<string>();
    for (const directory of ["apps/storefront/src", "apps/backoffice/src", "packages/ui/src"]) {
      for (const path of sources(resolve(root, directory))) {
        const source = readFileSync(path, "utf8");
        const pattern = /(?:(?:hover|focus|focus-visible|focus-within|disabled|aria-invalid|has-checked|group-hover|placeholder):)*(?:bg|text|border(?:-[lrtb])?|ring(?:-offset)?|outline|from|via|to|decoration|shadow|divide|accent)-(?:slate|blue|cyan|emerald|amber|orange|red|rose|sky|indigo)-\d+(?:\/\d+)?|(?:(?:hover|focus-visible):)*(?:bg|text|border|outline)-(?:white|black)(?:\/\d+)?|(?:bg|text|border|ring-offset)-\[#[^\]]+\](?:\/\d+)?/g;
        for (const [utility] of source.matchAll(pattern)) {
          if (!coverage.includes('[class~="' + utility + '"]')) missing.add(utility);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
  it.each(["storefront", "backoffice"])("loads the same semantic adapter with the independent %s palette", (application) => {
    const globals = readFileSync(resolve(root, "apps", application, "src/app/globals.css"), "utf8");
    expect(globals).toContain('@import "../../../../packages/ui/src/theme-coverage.css"');
    const tokens = readFileSync(resolve(root, "apps", application, "src/styles/design-tokens.css"), "utf8");
    for (const token of ["inverse-surface", "inverse-text", "inverse-muted", "inverse-accent", "inverse-accent-text", "overlay"]) {
      expect(tokens).toContain("--ds-" + token + ":");
    }
    expect(coverage).toContain('[data-tone-region="surface"]');
    expect(coverage).toContain('[data-tone-region="inverse"]');
  });
  it("supports native invalid/disabled states, visible focus and reduced motion", () => {
    for (const fragment of ['[aria-invalid="true"]', ":disabled", ":focus-visible", "prefers-reduced-motion", "--ui-danger", "--ui-disabled-text"]) {
      expect(coverage).toContain(fragment);
    }
  });
});
