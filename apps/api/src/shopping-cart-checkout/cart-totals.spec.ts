import { describe, expect, it } from "vitest";

import { addMoneyAmounts, calculateCartTotals } from "./cart-totals";

describe("calculateCartTotals", () => {
  it("uses exact minor-unit arithmetic for line subtotals and the total", () => {
    expect(
      calculateCartTotals([
        { quantity: 3, unitPrice: "0.10" },
        { quantity: 2, unitPrice: "0.29" },
      ]),
    ).toEqual({
      lineSubtotals: ["0.30", "0.58"],
      subtotal: "0.88",
      total: "0.88",
    });
  });

  it("normalizes empty totals and one-decimal prices to two decimals", () => {
    expect(calculateCartTotals([])).toEqual({
      lineSubtotals: [],
      subtotal: "0.00",
      total: "0.00",
    });
    expect(calculateCartTotals([{ quantity: 2, unitPrice: "10.5" }])).toEqual({
      lineSubtotals: ["21.00"],
      subtotal: "21.00",
      total: "21.00",
    });
  });

  it("adds fixed-precision totals without floating-point arithmetic", () => {
    expect(addMoneyAmounts("0.29", "5.00", "100.05")).toBe("105.34");
  });
});
