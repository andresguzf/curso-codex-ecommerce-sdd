import type { ProductListItem } from "@technology-ecommerce/api-schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "../src/features/catalog/product-card";

vi.mock("../src/features/wishlist/wishlist-button", () => ({
  WishlistButton: () => <button type="button">Guardar en deseos</button>,
}));

const fixtureCoverImage = {
  ...{ url: "/images/product-placeholder.svg", storageKey: "default" },
  id: "18ef6b72-3291-4bd7-a68f-0eec92d54d7c", altText: "Portada de producto de ejemplo",
  isPrimary: true, sortOrder: 0, width: null, height: null, mimeType: null,
};

const product: ProductListItem = {
  id: "10184fd0-3dcb-47cf-af70-a8be4c765421", name: "Monitor profesional Nova 27",
  sku: "NOVA-27", slug: "monitor-nova-27", description: "Pantalla para trabajar y crear.",
  price: "1299.90", currency: "USD", stockAvailable: 14, status: "ACTIVE",
  coverImage: fixtureCoverImage,
  image: { url: "/images/product-placeholder.svg", storageKey: "default" },
  category: null, tags: [], createdAt: "2026-09-04T12:00:00.000Z", updatedAt: "2026-09-04T12:00:00.000Z",
};

describe("commercial product card", () => {
  it("uses only the explicit cover rather than a divergent legacy image", () => {
    render(<ProductCard product={{ ...product, coverImage: { ...fixtureCoverImage, url: "/images/explicit-cover.svg" }, image: { storageKey: "legacy", url: "/images/legacy-image.svg" } }} onAddToCart={vi.fn()} />);
    expect(new URL(screen.getByRole("img", { name: product.name }).getAttribute("src")!, "http://localhost").pathname).toBe("/images/explicit-cover.svg");
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Imagen siguiente|Imagen anterior/ })).not.toBeInTheDocument();
  });

  it("retains the safe compatibility fallback when no explicit cover exists", () => {
    render(<ProductCard product={{ ...product, coverImage: null }} onAddToCart={vi.fn()} />);
    expect(new URL(screen.getByRole("img", { name: product.name }).getAttribute("src")!, "http://localhost").pathname).toBe("/images/product-placeholder.svg");
  });

  it("prioritizes image, title, USD price, availability and public purchase without administrative UI", () => {
    const onAddToCart = vi.fn();
    render(<ProductCard product={product} onAddToCart={onAddToCart} />);
    expect(screen.getByRole("article")).toHaveClass("bg-[var(--ds-surface)]", "rounded-[var(--ds-radius-panel)]");
    expect(screen.getByRole("img", { name: product.name })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Ver detalle de ${product.name}` })).toHaveClass("absolute", "inset-0");
    expect(screen.getByRole("heading", { name: product.name })).toBeInTheDocument();
    expect(screen.getByText("$1,299.90")).toBeInTheDocument();
    expect(screen.getByText("14 disponibles")).toHaveClass("text-[var(--ds-success)]");
    const purchase = screen.getByRole("button", { name: `Agregar ${product.name} al carrito` });
    expect(purchase).toHaveClass("bg-[var(--ds-accent)]", "text-[var(--ds-accent-text)]");
    expect(purchase.parentElement).toHaveClass("flex-wrap");
    fireEvent.click(purchase);
    expect(onAddToCart).toHaveBeenCalledWith(product);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar|eliminar|facturar/i })).not.toBeInTheDocument();
  });

  it("names unavailable stock and disables purchase without relying only on color", () => {
    render(<ProductCard product={{ ...product, stockAvailable: 0 }} onAddToCart={vi.fn()} />);
    expect(screen.getByText("Agotado")).toHaveClass("text-[var(--ds-danger)]");
    expect(screen.getByRole("button", { name: `Agregar ${product.name} al carrito` })).toBeDisabled();
    expect(screen.getByText("Sin stock")).toBeInTheDocument();
  });

  it("keeps pending feedback and prevents duplicate purchase clicks", () => {
    render(<ProductCard isAdding product={product} onAddToCart={vi.fn()} />);
    expect(screen.getByRole("button", { name: `Agregar ${product.name} al carrito` })).toBeDisabled();
    expect(screen.getByText("Agregando…")).toBeInTheDocument();
  });
});
