"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { WishlistItem } from "@technology-ecommerce/api-schemas";
import { ErrorState, LoadingState, Pagination } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useSessionStore } from "../auth/session";
import { useAddToCart } from "../cart/use-add-to-cart";
import { useWishlistPage } from "./use-wishlist";
import { WishlistCard } from "./wishlist-card";

export function WishlistPage() {
  const params = useSearchParams();
  const router = useRouter();
  const candidate = Number(params.get("page") ?? 1);
  const page = Number.isInteger(candidate) && candidate > 0 && candidate <= 1_000_000 ? candidate : 1;
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const returnTo = `/account/wishlist${params.size ? `?${params}` : ""}`;

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [returnTo, router, status]);

  return <main data-slot="customer-page" className="min-h-screen bg-[#f8fafc] px-4 py-10 text-slate-950 sm:px-8 sm:py-14">
    <div className="mx-auto max-w-6xl">
      {status !== "authenticated" || !session ? <LoadingState message="Validando acceso a tus deseos…" />
        : session.user.role !== "CUSTOMER" ? <section><h1 className="text-3xl font-black">Área de clientes</h1><p className="my-4">Para guardar productos utiliza una cuenta de cliente.</p><Link href="/" className="font-bold text-blue-700 underline">Volver a la tienda</Link></section>
          : <WishlistContent page={page} onPageChange={(next) => router.push(`/account/wishlist?page=${next}`)} />}
    </div>
  </main>;
}

function WishlistContent({ page, onPageChange }: Readonly<{ page: number; onPageChange: (page: number) => void }>) {
  const query = useWishlistPage(page);
  const customerId = useSessionStore((state) => state.session?.user.id);
  const queryClient = useQueryClient();
  const { addProduct, isAdding } = useAddToCart();

  async function addFromWishlist(item: WishlistItem): Promise<void> {
    if (!item.product.isAvailable || item.productStatus !== "ACTIVE" || item.productDeletedAt !== null || isAdding) return;
    await addProduct({ id: item.productId, name: item.product.name });
    void queryClient.invalidateQueries({ queryKey: ["wishlist", customerId] });
  }

  return <>
    <Link href="/" className="text-sm font-bold text-blue-700 underline">← Seguir explorando</Link>
    <header className="mb-9 mt-8 border-b border-slate-200 pb-8">
      <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Tu selección · Tecnología</p>
      <h1 className="mb-0 mt-3 text-4xl font-black tracking-[-0.035em] sm:text-5xl">Tus deseos, a mano.</h1>
      <p className="mb-0 mt-4 max-w-2xl leading-7 text-slate-600">Conserva los equipos que te interesan. La disponibilidad puede cambiar; vuelve a revisarla antes de comprar.</p>
    </header>
    {query.isPending ? <LoadingState message="Cargando tus deseos…" /> : null}
    {query.isError ? <ErrorState message="No pudimos cargar tus deseos. Comprueba tu sesión y vuelve a intentarlo." action={<button type="button" className="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white" onClick={() => void query.refetch()}>Intentar nuevamente</button>} /> : null}
    {query.data ? <>
      <p className="mb-5 text-sm font-semibold text-slate-600" role="status">{query.data.totalItems} productos guardados</p>
      {query.data.items.length ? <ol className="mb-9 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {query.data.items.map((item) => <li key={item.id}><WishlistCard isAdding={isAdding} item={item} onAddToCart={(selected) => { void addFromWishlist(selected); }} /></li>)}
      </ol> : <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><h2 className="m-0 text-2xl font-black">{page > 1 ? "No hay deseos en esta página" : "Todavía no guardaste productos"}</h2><p className="mx-auto mt-3 max-w-lg text-slate-600">{page > 1 ? "Vuelve al inicio de tu lista para ver los productos guardados." : "Explora el catálogo y pulsa el corazón en los equipos que quieras recordar."}</p>{page > 1 ? <button type="button" className="mt-4 font-bold text-blue-700 underline" onClick={() => onPageChange(1)}>Volver a la primera página</button> : <Link href="/" className="mt-4 inline-block font-bold text-blue-700 underline">Explorar productos</Link>}</section>}
      {query.data.totalPages > 0 && page <= query.data.totalPages ? <Pagination page={page} totalPages={query.data.totalPages} onPageChange={onPageChange} /> : null}
    </> : null}
  </>;
}
