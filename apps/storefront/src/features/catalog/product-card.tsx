import type { ProductListItem } from "@technology-ecommerce/api-schemas";
import Link from "next/link";

import { formatProductPrice } from "./catalog-format";
import { ProductClassifications } from "./product-classifications";
import { ProductImage } from "./product-image";
import { WishlistButton } from "../wishlist/wishlist-button";

export function ProductCard({
  isAdding,
  onAddToCart,
  product,
}: Readonly<{
  isAdding?: boolean;
  onAddToCart: (product: ProductListItem) => void;
  product: ProductListItem;
}>) {
  const isOutOfStock = product.stockAvailable === 0;

  return (
    <article data-slot="product-card" className="group flex min-w-0 flex-col overflow-hidden rounded-[var(--ds-radius-panel)] border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-[var(--ds-elevation)] transition duration-300 hover:-translate-y-1 hover:border-[var(--ds-accent)] motion-reduce:transform-none">
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--ds-surface-subtle)]">
        <Link className="absolute inset-0 focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--ds-focus)]" aria-label={`Ver detalle de ${product.name}`} href={`/products/${product.id}`}>
          <ProductImage
            alt={product.name}
            className="object-cover transition duration-500 group-hover:scale-[1.035] motion-reduce:transform-none"
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw"
            src={product.coverImage?.url ?? product.image.url}
          />
        </Link>
        <span data-tone-region="inverse" className="absolute left-4 top-4 rounded-full bg-[#081426]/90 px-3 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
          {product.sku}
        </span>
        <div className="absolute right-4 top-4"><WishlistButton productId={product.id} productName={product.name} /></div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <ProductClassifications category={product.category} compact tags={product.tags} />
        <div className="mt-3 grid gap-3">
          <h2 className="m-0 text-xl font-black leading-tight tracking-tight text-[var(--ds-text)]">
            <Link className="rounded-sm hover:text-[var(--ds-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" href={`/products/${product.id}`}>
              {product.name}
            </Link>
          </h2>
          <span className={isOutOfStock ? "shrink-0 text-xs font-bold text-[var(--ds-danger)]" : "shrink-0 text-xs font-bold text-[var(--ds-success)]"}>
            {isOutOfStock ? "Agotado" : `${product.stockAvailable} disponibles`}
          </span>
        </div>
        <p className="mb-0 mt-3 line-clamp-2 text-sm leading-6 text-[var(--ds-text-muted)]">{product.description}</p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-6">
          <p className="m-0 text-2xl font-black tracking-tight text-[var(--ds-text)]">
            {formatProductPrice(product.price)}
          </p>
          <button
            aria-label={`Agregar ${product.name} al carrito`}
            className="min-h-11 rounded-xl bg-[var(--ds-accent)] px-4 py-2 text-sm font-black text-[var(--ds-accent-text)] transition hover:bg-[var(--ds-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--ds-disabled)] disabled:text-[var(--ds-disabled-text)]"
            disabled={isOutOfStock || isAdding}
            onClick={() => onAddToCart(product)}
            type="button"
          >
            {isOutOfStock ? "Sin stock" : isAdding ? "Agregando…" : "Agregar"}
          </button>
        </div>
      </div>
    </article>
  );
}
