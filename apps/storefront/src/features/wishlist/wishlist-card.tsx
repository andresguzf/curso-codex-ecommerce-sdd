"use client";

import type { WishlistItem } from "@technology-ecommerce/api-schemas";
import Link from "next/link";

import { formatProductPrice } from "../catalog/catalog-format";
import { ProductImage } from "../catalog/product-image";
import { WishlistButton } from "./wishlist-button";

export function WishlistCard({ isAdding, item, onAddToCart }: Readonly<{
  isAdding: boolean;
  item: WishlistItem;
  onAddToCart: (item: WishlistItem) => void;
}>) {
  const inactive = item.productStatus === "INACTIVE" || item.productDeletedAt !== null;
  const available = !inactive && item.product.isAvailable && item.product.stockAvailable > 0;

  return <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-35px_rgba(15,23,42,0.35)]">
    <div className="relative aspect-[4/3] bg-slate-100">
      <ProductImage alt={item.product.name} src={item.product.image?.url} fill className="object-cover" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw" />
    </div>
    <div className="flex flex-1 flex-col p-5">
      <p className={available ? "m-0 text-xs font-bold uppercase tracking-wider text-emerald-700" : "m-0 text-xs font-bold uppercase tracking-wider text-red-700"}>
        {inactive ? "Ya no está en catálogo" : available ? `${item.product.stockAvailable} disponibles` : "Agotado por ahora"}
      </p>
      <h2 className="mb-0 mt-3 text-xl font-black tracking-tight">{item.product.name}</h2>
      <p className="mb-0 mt-3 text-2xl font-black">{formatProductPrice(item.product.price)}</p>
      <div className="mt-auto pt-6">
        <button
          aria-label={`Agregar ${item.product.name} al carrito desde deseos`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600"
          disabled={!available || isAdding}
          onClick={() => onAddToCart(item)}
          type="button"
        >
          {inactive ? "No disponible" : !available ? "Sin stock" : isAdding ? "Agregando…" : "Agregar al carrito"}
        </button>
        <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
          {inactive ? <span className="text-sm text-slate-500">Producto retirado</span>
            : <Link href={`/products/${item.productId}`} className="inline-flex min-h-11 items-center rounded-xl px-1 text-sm font-bold text-blue-700 underline underline-offset-4 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Ver producto</Link>}
          <WishlistButton productId={item.productId} productName={item.product.name} />
        </div>
      </div>
    </div>
  </article>;
}
