"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";

import { useAddToCart } from "../cart/use-add-to-cart";
import { getPublicProduct, PublicProductNotFoundError } from "./catalog-api";
import { formatProductPrice } from "./catalog-format";
import { ProductClassifications } from "./product-classifications";
import { ProductGallery } from "./product-gallery";
import { WishlistButton } from "../wishlist/wishlist-button";

export function ProductDetail({ productId }: Readonly<{ productId: string }>) {
  const { addProduct, isAdding } = useAddToCart();
  const productQuery = useQuery({
    queryFn: () => getPublicProduct(productId),
    queryKey: ["catalog", "public", "product", productId],
  });

  if (productQuery.isPending) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-12 lg:px-10 lg:py-20">
        <LoadingState message="Cargando detalle del producto…" />
      </main>
    );
  }

  if (productQuery.error instanceof PublicProductNotFoundError) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-6 py-20 text-center">
        <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[var(--ds-accent)]">Catálogo público</p>
        <h1 className="mb-0 mt-4 text-4xl font-black tracking-tight text-[var(--ds-text)]">Producto no disponible</h1>
        <p className="mx-auto mb-0 mt-5 max-w-xl text-base leading-7 text-[var(--ds-text-muted)]">
          Este producto no existe o ya no está activo en nuestro catálogo.
        </p>
        <Link className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-[var(--ds-accent)] px-5 py-2 font-bold text-[var(--ds-accent-text)] transition hover:bg-[var(--ds-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" href="/">
          Volver al catálogo
        </Link>
      </main>
    );
  }

  if (productQuery.isError) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-12 lg:px-10 lg:py-20">
        <ErrorState
          action={(
            <button className="min-h-11 rounded-lg bg-[var(--ds-accent)] px-4 py-2 text-sm font-bold text-[var(--ds-accent-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" onClick={() => void productQuery.refetch()} type="button">
              Intentar nuevamente
            </button>
          )}
          message="Comprueba que la API esté disponible y vuelve a intentarlo."
        />
      </main>
    );
  }

  const product = productQuery.data;
  const isOutOfStock = product.availability === "OUT_OF_STOCK";

  return (
    <main className="min-h-screen bg-[var(--ds-canvas)]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-14">
        <Link className="inline-flex rounded-sm text-sm font-bold text-[var(--ds-accent)] hover:text-[var(--ds-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" href="/">
          ← Volver al catálogo
        </Link>
        <article data-slot="product-detail" className="mt-7 grid overflow-hidden rounded-3xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-[var(--ds-elevation)] lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <ProductGallery images={product.images} key={`${product.id}:${product.images.map((image) => image.id).join(":")}`} productName={product.name} />
          <div className="flex flex-col p-7 sm:p-10 lg:p-12">
            <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--ds-accent)]">{product.sku}</p>
            <h1 className="mb-0 mt-4 text-balance text-4xl font-black leading-tight tracking-[-0.035em] text-[var(--ds-text)] sm:text-5xl">
              {product.name}
            </h1>
            <p className="mb-0 mt-6 text-base leading-8 text-[var(--ds-text-muted)]">{product.description}</p>
            <ProductClassifications category={product.category} tags={product.tags} />

            <div className="mt-9 border-y border-[var(--ds-border)] py-7">
              <p className="m-0 text-4xl font-black tracking-tight text-[var(--ds-text)]">
                {formatProductPrice(product.price)}
              </p>
              <p className={isOutOfStock ? "mb-0 mt-3 font-bold text-[var(--ds-danger)]" : "mb-0 mt-3 font-bold text-[var(--ds-success)]"}>
                {isOutOfStock ? "Agotado" : `${product.stockAvailable} unidades disponibles`}
              </p>
            </div>

            <button
              aria-label={`Agregar ${product.name} al carrito`}
              className="mt-8 min-h-12 rounded-xl bg-[var(--ds-accent)] px-6 py-3 font-black text-[var(--ds-accent-text)] transition hover:bg-[var(--ds-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--ds-disabled)] disabled:text-[var(--ds-disabled-text)]"
              disabled={isOutOfStock || isAdding}
              onClick={() => void addProduct(product)}
              type="button"
            >
              {isOutOfStock
                ? "Producto sin stock"
                : isAdding
                  ? "Agregando al carrito…"
                  : "Agregar al carrito"}
            </button>
            <div className="mt-3"><WishlistButton productId={product.id} productName={product.name} variant="label" /></div>
            <p className="mb-0 mt-4 text-center text-xs leading-5 text-[var(--ds-text-muted)]">
              La disponibilidad se volverá a validar al agregar y al finalizar la compra.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
