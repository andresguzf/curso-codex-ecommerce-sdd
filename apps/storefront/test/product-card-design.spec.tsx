import type { ProductListItem } from "@technology-ecommerce/api-schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "../src/features/catalog/product-card";

vi.mock("../src/features/wishlist/wishlist-button", () => ({
  WishlistButton: () => <button type="button">Guardar en deseos</button>,
}));

const product: ProductListItem = {
  id: "10184fd0-3dcb-47cf-af70-a8be4c765421", name: "Monitor profesional Nova 27",
  sku: "NOVA-27", slug: "monitor-nova-27", description: "Pantalla para trabajar y crear.",
  price: "1299.90", currency: "USD", stockAvailable: 14, status: "ACTIVE",
  image: { url: "/images/product-placeholder.svg", storageKey: "default" },
  category: null, tags: [], createdAt: "2026-09-04T12:00:00.000Z", updatedAt: "2026-09-04T12:00:00.000Z",
};

describe("commercial product card", () => {
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
