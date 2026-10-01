import type { ProductDetail } from "@technology-ecommerce/api-schemas";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductGallery } from "../src/features/catalog/product-gallery";

const images: ProductDetail["images"] = [0, 1, 2].map((index) => ({
  id: `10000000-0000-4000-8000-00000000000${index}`,
  storageKey: `test/${index}.webp`, url: `https://picsum.photos/id/${60 + index}/1200/900.webp`,
  altText: ["Vista frontal", "Vista lateral", "Conexiones del teclado"][index]!,
  isPrimary: index === 1, sortOrder: index, width: 1200, height: 900, mimeType: "image/webp",
}));

describe("manual product gallery", () => {
  it("starts on the cover and selects thumbnails without mutating it", async () => {
    const original = structuredClone(images);
    render(<ProductGallery images={images} productName="Teclado" />);
    expect(screen.getByRole("img", { name: "Vista lateral" })).toHaveAttribute("loading", "eager");
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 2 de 3");
    await userEvent.click(screen.getByRole("button", { name: "Ver imagen 3: Conexiones del teclado" }));
    expect(screen.getByRole("img", { name: "Conexiones del teclado" })).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("button", { name: /Ver imagen 3/ })).toHaveAttribute("aria-pressed", "true");
    expect(images).toEqual(original);
  });

  it("wraps manually, retains control focus, announces position and never advances on its own", async () => {
    render(<ProductGallery images={images} productName="Teclado" />);
    const next = screen.getByRole("button", { name: "Imagen siguiente" });
    await userEvent.click(next);
    expect(next).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 3 de 3");
    await userEvent.click(next);
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 1 de 3");
    await userEvent.click(screen.getByRole("button", { name: "Imagen anterior" }));
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 3 de 3");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("supports stage keyboard arrows, Home/End and thumbnail focus", async () => {
    render(<ProductGallery images={images} productName="Teclado" />);
    const stage = screen.getByLabelText("Imagen del producto");
    stage.focus();
    await userEvent.keyboard("{ArrowRight}{Home}");
    expect(stage).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 1 de 3");
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 3 de 3");
    screen.getByRole("button", { name: /Ver imagen 3/ }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: /Ver imagen 2/ })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 2 de 3");
  });

  it("supports horizontal swipes but ignores scrolling, short gestures and cancellation", () => {
    render(<ProductGallery images={images} productName="Teclado" />);
    const stage = screen.getByLabelText("Imagen del producto");
    const swipe = (x: number, y: number) => {
      fireEvent.touchStart(stage, { touches: [{ clientX: 200, clientY: 200 }] });
      fireEvent.touchEnd(stage, { changedTouches: [{ clientX: x, clientY: y }] });
    };
    swipe(100, 205);
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 3 de 3");
    swipe(300, 205);
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 2 de 3");
    swipe(180, 200);
    swipe(140, 400);
    fireEvent.touchStart(stage, { touches: [{ clientX: 200, clientY: 200 }] });
    fireEvent.touchCancel(stage);
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 100, clientY: 200 }] });
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 2 de 3");
  });

  it.each([{ items: [] }, { items: [images[0]!] }])("omits carousel controls for zero or one image", ({ items }) => {
    render(<ProductGallery images={items} productName="Teclado" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByLabelText("Imagen del producto")).not.toHaveAttribute("tabindex");
  });

  it("reserves a fixed aspect ratio and falls back safely on failed images", () => {
    render(<ProductGallery images={images} productName="Teclado" />);
    expect(screen.getByLabelText("Imagen del producto")).toHaveClass("aspect-square", "touch-pan-y");
    const image = screen.getByRole("img", { name: "Vista lateral" });
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "/images/product-placeholder.svg");
    expect(screen.getByRole("status")).toHaveTextContent("Imagen 2 de 3");
  });

  it("has no autoplay even after a minute and lazily loads thumbnails", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<ProductGallery images={images} productName="Teclado" />);
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(screen.getByRole("status")).toHaveTextContent("Imagen 2 de 3");
      expect(container.querySelectorAll('button img[loading="lazy"]')).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
