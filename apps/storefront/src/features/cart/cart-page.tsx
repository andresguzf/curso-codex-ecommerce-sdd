"use client";

import { ConfirmationDialog, ErrorState, LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useState } from "react";

import { CartApiError } from "./cart-api";
import { CartLine } from "./cart-line";
import { CartSummary } from "./cart-summary";
import { useCartUiStore } from "./cart-ui-store";
import { useCart } from "./use-cart";

type CartFeedback = Readonly<{
  message: string;
  tone: "error" | "success";
}>;

function errorMessage(error: unknown): string {
  return error instanceof CartApiError
    ? error.message
    : "No pudimos actualizar tu carrito. Inténtalo nuevamente.";
}

export function CartPage() {
  const [feedback, setFeedback] = useState<CartFeedback | null>(null);
  const notice = useCartUiStore((state) => state.notice);
  const clearNotice = useCartUiStore((state) => state.clearNotice);
  const removalItemId = useCartUiStore((state) => state.removalItemId);
  const cancelRemoval = useCartUiStore((state) => state.cancelRemoval);
  const requestRemoval = useCartUiStore((state) => state.requestRemoval);
  const {
    cartQuery,
    isRemoving,
    isUpdating,
    removeItem,
    updateItem,
  } = useCart();
  const removalItem = cartQuery.data?.items.find(
    (item) => item.id === removalItemId,
  );

  async function changeQuantity(itemId: string, quantity: number): Promise<void> {
    clearNotice();
    setFeedback(null);
    try {
      await updateItem({ itemId, quantity });
      setFeedback({
        message: "Cantidad y total actualizados.",
        tone: "success",
      });
    } catch (error) {
      setFeedback({ message: errorMessage(error), tone: "error" });
    }
  }

  async function confirmRemoval(): Promise<void> {
    if (!removalItemId) return;
    clearNotice();
    setFeedback(null);
    try {
      await removeItem(removalItemId);
      cancelRemoval();
      setFeedback({ message: "Producto eliminado del carrito.", tone: "success" });
    } catch (error) {
      setFeedback({ message: errorMessage(error), tone: "error" });
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-16">
        <Link
          className="inline-flex rounded-sm text-sm font-bold text-blue-700 hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          href="/"
        >
          ← Volver al catálogo
        </Link>
        <header className="mt-7 max-w-3xl">
          <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
            Selección guardada
          </p>
          <h1 className="mb-0 mt-3 text-4xl font-black tracking-[-0.035em] text-slate-950 sm:text-5xl">
            Tu carrito, sin sorpresas.
          </h1>
          <p className="mb-0 mt-4 text-base leading-7 text-slate-600">
            Ajusta unidades y revisa disponibilidad. Los precios y el stock se validan nuevamente al comprar.
          </p>
        </header>

        <div
          aria-live="polite"
          className={
            feedback || notice
              ? feedback?.tone !== "error"
                ? "mt-7 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
                : "mt-7 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900"
              : "sr-only"
          }
          role={feedback?.tone === "error" ? "alert" : "status"}
        >
          {feedback?.message ?? notice}
        </div>

        {cartQuery.isPending ? (
          <LoadingState className="mt-8" message="Cargando tu selección…" />
        ) : null}
        {cartQuery.isError ? (
          <ErrorState
            action={(
              <button
                className="min-h-11 rounded-lg bg-red-800 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2"
                onClick={() => void cartQuery.refetch()}
                type="button"
              >
                Intentar nuevamente
              </button>
            )}
            className="mt-8"
            message="Comprueba tu sesión y la conexión con la tienda."
          />
        ) : null}

        {cartQuery.data?.items.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-[0_24px_70px_-52px_rgba(15,23,42,0.6)]">
            <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Carrito vacío
            </p>
            <h2 className="mb-0 mt-3 text-3xl font-black tracking-tight text-slate-950">
              Encuentra tu próximo equipo
            </h2>
            <p className="mx-auto mb-0 mt-3 max-w-lg leading-7 text-slate-600">
              Explora el catálogo y agrega los productos que quieras comparar o comprar.
            </p>
            <Link
              className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-blue-700 px-6 py-3 font-black text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              href="/"
            >
              Explorar productos
            </Link>
          </section>
        ) : null}

        {cartQuery.data && cartQuery.data.items.length > 0 ? (
          <div className="mt-9 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
            <section
              aria-label="Productos del carrito"
              aria-busy={isUpdating || isRemoving}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_28px_80px_-55px_rgba(15,23,42,0.55)] sm:p-8"
            >
              {cartQuery.data.items.map((item) => (
                <CartLine
                  isUpdating={isUpdating || isRemoving}
                  item={item}
                  key={item.id}
                  onChangeQuantity={(quantity) =>
                    void changeQuantity(item.id, quantity)
                  }
                  onRequestRemoval={() => requestRemoval(item.id)}
                />
              ))}
            </section>
            <CartSummary cart={cartQuery.data} />
          </div>
        ) : null}
      </div>

      <ConfirmationDialog
        confirmLabel="Quitar producto"
        description={
          removalItem
            ? `${removalItem.product.name} dejará de aparecer en tu carrito.`
            : "El producto dejará de aparecer en tu carrito."
        }
        isPending={isRemoving}
        onCancel={cancelRemoval}
        onConfirm={() => void confirmRemoval()}
        open={Boolean(removalItemId)}
        title="¿Quitar este producto?"
      />
    </main>
  );
}
