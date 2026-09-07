import type { ProductListItem } from "@technology-ecommerce/api-schemas";
import Link from "next/link";

import { formatProductPrice } from "./catalog-format";
import { ProductImage } from "./product-image";

export function ProductCard({
  onAddToCart,
  product,
}: Readonly<{
  onAddToCart?: (product: ProductListItem) => void;
  product: ProductListItem;
}>) {
  const isOutOfStock = product.stockAvailable === 0;

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-35px_rgba(15,23,42,0.55)] transition duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_24px_60px_-30px_rgba(37,99,235,0.38)] motion-reduce:transform-none">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <Link aria-label={`Ver detalle de ${product.name}`} href={`/products/${product.id}`}>
          <ProductImage
            alt={product.name}
            className="object-cover transition duration-500 group-hover:scale-[1.035] motion-reduce:transform-none"
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw"
            src={product.image.url}
          />
        </Link>
        <span className="absolute left-4 top-4 rounded-full bg-[#081426]/90 px-3 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
          {product.sku}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="m-0 text-xl font-black leading-tight tracking-tight text-slate-950">
            <Link className="rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href={`/products/${product.id}`}>
              {product.name}
            </Link>
          </h2>
          <span className={isOutOfStock ? "shrink-0 text-xs font-bold text-red-700" : "shrink-0 text-xs font-bold text-emerald-700"}>
            {isOutOfStock ? "Agotado" : `${product.stockAvailable} disponibles`}
          </span>
        </div>
        <p className="mb-0 mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{product.description}</p>
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <p className="m-0 text-2xl font-black tracking-tight text-slate-950">
            {formatProductPrice(product.price, product.currency)}
          </p>
          <button
            aria-label={`Agregar ${product.name} al carrito`}
            className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            disabled={isOutOfStock}
            onClick={() => onAddToCart?.(product)}
            type="button"
          >
            {isOutOfStock ? "Sin stock" : "Agregar"}
          </button>
        </div>
      </div>
    </article>
  );
}
