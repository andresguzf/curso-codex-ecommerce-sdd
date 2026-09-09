import type { ProductListItem } from "@technology-ecommerce/api-schemas";

import { ProductCard } from "./product-card";

export function ProductGrid({
  isAdding,
  onAddToCart,
  products,
}: Readonly<{
  isAdding?: boolean;
  onAddToCart: (product: ProductListItem) => void;
  products: readonly ProductListItem[];
}>) {
  const visibleProducts = products.filter((product) => product.status === "ACTIVE");

  if (visibleProducts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <h2 className="m-0 text-xl font-black text-slate-950">No encontramos productos</h2>
        <p className="mb-0 mt-2 text-sm text-slate-600">Prueba con una búsqueda más amplia.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {visibleProducts.map((product) => (
        <ProductCard
          isAdding={isAdding}
          key={product.id}
          onAddToCart={onAddToCart}
          product={product}
        />
      ))}
    </div>
  );
}
