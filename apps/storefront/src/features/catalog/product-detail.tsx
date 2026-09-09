"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";

import { CartActionFeedback } from "../cart/cart-action-feedback";
import { useAddToCart } from "../cart/use-add-to-cart";
import { getPublicProduct, PublicProductNotFoundError } from "./catalog-api";
import { formatProductPrice } from "./catalog-format";
import { ProductImage } from "./product-image";

export function ProductDetail({ productId }: Readonly<{ productId: string }>) {
  const { addProduct, feedback, isAdding } = useAddToCart();
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
        <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Catálogo público</p>
        <h1 className="mb-0 mt-4 text-4xl font-black tracking-tight text-slate-950">Producto no disponible</h1>
        <p className="mx-auto mb-0 mt-5 max-w-xl text-base leading-7 text-slate-600">
          Este producto no existe o ya no está activo en nuestro catálogo.
        </p>
        <Link className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 py-2 font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="/">
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
            <button className="min-h-11 rounded-lg bg-red-800 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2" onClick={() => void productQuery.refetch()} type="button">
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
    <main className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-14">
        <Link className="inline-flex rounded-sm text-sm font-bold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href="/">
          ← Volver al catálogo
        </Link>
        <article className="mt-7 grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_-48px_rgba(15,23,42,0.55)] lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <div className="relative min-h-[22rem] bg-slate-100 sm:min-h-[32rem] lg:min-h-[40rem]">
            <ProductImage
              alt={product.name}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 56vw, 100vw"
              src={product.image.url}
            />
          </div>
          <div className="flex flex-col p-7 sm:p-10 lg:p-12">
            <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{product.sku}</p>
            <h1 className="mb-0 mt-4 text-balance text-4xl font-black leading-tight tracking-[-0.035em] text-slate-950 sm:text-5xl">
              {product.name}
            </h1>
            <p className="mb-0 mt-6 text-base leading-8 text-slate-600">{product.description}</p>

            <div className="mt-9 border-y border-slate-200 py-7">
              <p className="m-0 text-4xl font-black tracking-tight text-slate-950">
                {formatProductPrice(product.price)}
              </p>
              <p className={isOutOfStock ? "mb-0 mt-3 font-bold text-red-700" : "mb-0 mt-3 font-bold text-emerald-700"}>
                {isOutOfStock ? "Agotado" : `${product.stockAvailable} unidades disponibles`}
              </p>
            </div>

            <button
              aria-label={`Agregar ${product.name} al carrito`}
              className="mt-8 min-h-12 rounded-xl bg-blue-700 px-6 py-3 font-black text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
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
            <div className="mt-4">
              <CartActionFeedback feedback={feedback} />
            </div>
            <p className="mb-0 mt-4 text-center text-xs leading-5 text-slate-500">
              La disponibilidad se volverá a validar al agregar y al finalizar la compra.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
