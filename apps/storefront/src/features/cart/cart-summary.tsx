"use client";

import type { ActiveCart } from "@technology-ecommerce/api-schemas";
import Link from "next/link";

import { formatProductPrice } from "../catalog/catalog-format";

export function CartSummary({ cart }: Readonly<{ cart: ActiveCart }>) {

  return (
    <aside
      aria-labelledby="cart-summary-title"
      className="relative overflow-hidden rounded-3xl bg-[#081426] p-7 text-white shadow-[0_30px_70px_-36px_rgba(8,20,38,0.9)] lg:sticky lg:top-8"
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 size-48 rounded-full border-[28px] border-blue-500/15"
      />
      <div className="relative">
        <p className="m-0 font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-blue-300">
          Resumen en vivo
        </p>
        <h2 className="mb-0 mt-2 text-2xl font-black tracking-tight" id="cart-summary-title">
          Tu selección
        </h2>
        <dl className="mt-8 space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <dt className="text-slate-300">Unidades</dt>
            <dd className="m-0 font-mono font-bold">{cart.totalQuantity}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <dt className="text-slate-300">Subtotal</dt>
            <dd className="m-0 font-bold">
              {formatProductPrice(cart.subtotal)}
            </dd>
          </div>
          <div className="flex items-end justify-between gap-4 pt-1">
            <dt className="font-bold">Total actual</dt>
            <dd className="m-0 text-3xl font-black tracking-tight">
              {formatProductPrice(cart.total)}
            </dd>
          </div>
        </dl>
        <p className="mb-0 mt-5 text-xs leading-5 text-slate-300">
          Envío y forma de pago se seleccionan al confirmar la compra.
        </p>
        <Link
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081426]"
          href="/checkout"
        >
          Continuar al checkout
        </Link>
        <Link
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081426]"
          href="/"
        >
          Seguir explorando productos
        </Link>
      </div>
    </aside>
  );
}
