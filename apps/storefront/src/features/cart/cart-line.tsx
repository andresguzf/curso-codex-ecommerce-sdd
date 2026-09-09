import type { CartItem } from "@technology-ecommerce/api-schemas";
import Link from "next/link";

import { formatProductPrice } from "../catalog/catalog-format";
import { ProductImage } from "../catalog/product-image";

export function CartLine({
  isUpdating,
  item,
  onChangeQuantity,
  onRequestRemoval,
}: Readonly<{
  isUpdating: boolean;
  item: CartItem;
  onChangeQuantity: (quantity: number) => void;
  onRequestRemoval: () => void;
}>) {
  const exceedsStock = item.quantity > item.product.stockAvailable;
  const canIncrease =
    item.product.isAvailable && item.quantity < item.product.stockAvailable;
  const availabilityMessage = exceedsStock
    ? `Ajusta la cantidad a ${item.product.stockAvailable} o menos.`
    : item.product.isAvailable
      ? `${item.product.stockAvailable} unidades disponibles`
      : "Producto temporalmente no disponible";

  return (
    <article className="grid gap-5 border-b border-slate-200 py-7 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <Link
        aria-label={`Ver ${item.product.name}`}
        className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
        href={`/products/${item.productId}`}
      >
        <ProductImage
          alt={item.product.name}
          className="object-cover transition duration-300 hover:scale-[1.03] motion-reduce:transform-none"
          fill
          sizes="136px"
          src={item.product.image.url}
        />
      </Link>

      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="m-0 font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-blue-700">
              {item.product.sku}
            </p>
            <h2 className="mb-0 mt-1 text-xl font-black tracking-tight text-slate-950">
              <Link
                className="rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
                href={`/products/${item.productId}`}
              >
                {item.product.name}
              </Link>
            </h2>
            <p
              className={
                exceedsStock || !item.product.isAvailable
                  ? "mb-0 mt-2 text-sm font-bold text-red-700"
                  : "mb-0 mt-2 text-sm font-semibold text-emerald-700"
              }
            >
              {availabilityMessage}
            </p>
          </div>
          <p className="m-0 shrink-0 text-xl font-black tracking-tight text-slate-950">
            {formatProductPrice(item.subtotal)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            aria-label={`Cantidad de ${item.product.name}`}
            className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-50 p-1"
            role="group"
          >
            <button
              aria-label={`Disminuir cantidad de ${item.product.name}`}
              className="grid size-10 place-items-center rounded-lg text-xl font-bold text-slate-800 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={isUpdating || item.quantity <= 1}
              onClick={() => onChangeQuantity(item.quantity - 1)}
              type="button"
            >
              −
            </button>
            <output
              aria-live="polite"
              className="min-w-12 text-center font-mono text-sm font-black text-slate-950"
            >
              {item.quantity}
            </output>
            <button
              aria-label={`Aumentar cantidad de ${item.product.name}`}
              className="grid size-10 place-items-center rounded-lg text-xl font-bold text-slate-800 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={isUpdating || !canIncrease}
              onClick={() => onChangeQuantity(item.quantity + 1)}
              type="button"
            >
              +
            </button>
          </div>

          <button
            className="min-h-11 rounded-lg px-2 text-sm font-bold text-red-700 underline decoration-red-200 underline-offset-4 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
            disabled={isUpdating}
            onClick={onRequestRemoval}
            type="button"
          >
            Quitar del carrito
          </button>
        </div>
      </div>
    </article>
  );
}
