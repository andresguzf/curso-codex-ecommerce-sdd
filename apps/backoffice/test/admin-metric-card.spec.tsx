import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminMetricCard } from "../src/features/layout/admin-metric-card";

describe("administrative indicator", () => {
  it("associates a real value with its label using a compact semantic surface", () => {
    const { container } = render(<AdminMetricCard label="Stock disponible" value={14} description="NOVA-27" />);
    expect(screen.getByText("Stock disponible", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("14", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("NOVA-27")).toBeInTheDocument();
    expect(container.querySelector("dl")).toHaveClass("bg-[var(--ds-surface)]", "rounded-[var(--ds-radius-panel)]");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("shows zero without inventing an empty or loading state", () => {
    const { container } = render(<AdminMetricCard label="Stock disponible" value={0} />);
    expect(screen.getByText("0", { selector: "dd" })).toBeInTheDocument();
    expect(container.querySelectorAll("dd")).toHaveLength(1);
  });
});
