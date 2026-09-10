"use client";

import { orderStatusSchema } from "@technology-ecommerce/api-schemas";
import { LoadingState, Pagination } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatProductPrice } from "../catalog/catalog-format";
import { OrdersAccessGate } from "./orders-access-gate";
import { orderDate, orderLabels, OrdersError, OrderStatus } from "./order-presentation";
import { useMyOrders } from "./use-orders";

export function OrdersPage() {
  const params = useSearchParams();
  const returnTo = `/account/orders${params.size ? `?${params}` : ""}`;
  return <OrdersAccessGate returnTo={returnTo}><OrdersList /></OrdersAccessGate>;
}

export function OrdersList() {
  const params = useSearchParams();
  const router = useRouter();
  const candidate = Number(params.get("page") ?? 1);
  const page = Number.isInteger(candidate) && candidate > 0 && candidate <= 1_000_000 ? candidate : 1;
  const parsedStatus = orderStatusSchema.safeParse(params.get("status"));
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const query = useMyOrders({ page, pageSize: 20, ...(status ? { status } : {}) });
  function navigate(nextPage: number, nextStatus = status ?? "") {
    const next = new URLSearchParams({ page: String(nextPage) });
    if (nextStatus) next.set("status", nextStatus);
    router.push(`/account/orders?${next}`);
  }
  return <>
    <Link href="/" className="text-sm font-bold text-blue-700 underline">← Volver a la tienda</Link>
    <header className="my-8"><p className="text-sm font-bold uppercase tracking-widest text-blue-700">Tu cuenta · Historial</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Mis compras</h1><p className="mt-3 text-slate-600">Consulta tus pedidos y los detalles de cada compra, del más reciente al más antiguo.</p></header>
    <label className="mb-7 flex flex-wrap items-center gap-3 font-semibold">Estado de la orden
      <select value={status ?? ""} onChange={(event) => navigate(1, event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 focus-visible:outline-2 focus-visible:outline-blue-700">
        <option value="">Todos los estados</option>{orderStatusSchema.options.map((value) => <option key={value} value={value}>{orderLabels[value]}</option>)}
      </select>
    </label>
    {query.isPending ? <LoadingState message="Cargando tus compras…" /> : query.isError ? <OrdersError error={query.error} retry={() => { void query.refetch(); }} returnTo={`/account/orders?${params}`} /> : <>
      <p role="status" className="mb-4 text-sm text-slate-600">{query.data.totalItems} compras encontradas</p>
      {!query.data.items.length ? <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="text-2xl font-bold">{page > 1 ? "No hay compras en esta página" : status ? "No tienes compras con este estado" : "Tu primera compra empieza en la tienda"}</h2><p className="my-4 text-slate-600">{page > 1 ? "Vuelve a la primera página para consultar los resultados." : "Aquí aparecerán tus pedidos después de completar una compra."}</p>{page > 1 ? <button type="button" className="font-bold text-blue-700 underline" onClick={() => navigate(1)}>Volver a la primera página</button> : <Link href="/" className="font-bold text-blue-700 underline">Explorar productos</Link>}</section>
        : <ol className="mb-8 grid list-none gap-4 p-0">{query.data.items.map((order) => <li key={order.id}><article className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6"><div className="min-w-0"><p className="mb-2 text-sm text-slate-600"><time dateTime={order.createdAt}>{orderDate(order.createdAt)}</time></p><h2 className="break-all font-mono text-sm font-bold">{order.number}</h2><div className="mt-3"><OrderStatus status={order.status} /></div></div><div className="flex flex-wrap items-center gap-6"><p className="text-xl font-black tabular-nums">{formatProductPrice(order.total)} <span className="text-xs text-slate-600">USD</span></p><Link href={`/account/orders/${order.id}`} aria-label={`Ver pedido ${order.number}`} className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Ver pedido →</Link></div></article></li>)}</ol>}
      {query.data.totalPages > 0 && page <= query.data.totalPages && <Pagination page={page} totalPages={query.data.totalPages} onPageChange={(next) => navigate(next)} />}
    </>}
  </>;
}
