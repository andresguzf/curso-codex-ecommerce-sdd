import { describe, expect, it } from "vitest";
import { normalizeSlug, slugCandidate } from "./slug.js";

describe("catalog slugs", () => {
  it("normalizes accents, punctuation and spaces", () => {
    expect(normalizeSlug("  Portátil  GÁMER / 14\"  ")).toBe("portatil-gamer-14");
    expect(normalizeSlug("Niño + Café")).toBe("nino-cafe");
    expect(() => normalizeSlug("!!!")).toThrow("SLUG_EMPTY");
  });

  it("generates deterministic bounded collision candidates", () => {
    expect(slugCandidate("portatil-pro", 1)).toBe("portatil-pro");
    expect(slugCandidate("portatil-pro", 2)).toBe("portatil-pro-2");
    expect(slugCandidate("portatil-pro", 3)).toBe("portatil-pro-3");
    expect(slugCandidate("x".repeat(220), 2)).toHaveLength(220);
  });
});
