import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductImage } from "../src/features/catalog/product-image";

describe("catalog image delivery", () => {
  it("loads Picsum directly at thumbnail and stage sizes, including after a source change", () => {
    const picsum = "https://picsum.photos/id/0/1200/900.webp";
    const cloud = "https://res.cloudinary.com/demo/image/upload/v123/codex-storefront/cover.png";
    const { rerender } = render(<ProductImage alt="Producto" height={80} sizes="80px" src={picsum} width={80} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", picsum);
    expect(screen.getByRole("img")).not.toHaveAttribute("srcset");
    rerender(<ProductImage alt="Producto" height={600} src={picsum} width={600} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", picsum);
    rerender(<ProductImage alt="Producto" height={80} src={cloud} width={80} />);
    expect(screen.getByRole("img").getAttribute("src")).toContain("/_next/image?");
    rerender(<ProductImage alt="Producto" height={80} src={picsum} width={80} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", picsum);
  });

  it("preserves fallback after a real load failure and recovers when the source changes", () => {
    const { rerender } = render(<ProductImage alt="Producto" height={80} src="https://picsum.photos/id/0/1200/900.webp" width={80} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/images/product-placeholder.svg");
    rerender(<ProductImage alt="Producto" height={80} src="https://picsum.photos/id/6/1200/900.webp" width={80} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://picsum.photos/id/6/1200/900.webp");
  });
});
