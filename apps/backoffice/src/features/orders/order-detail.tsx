"use client";

import { useState } from "react";
import { ConfirmationDialog, ErrorState, LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useSessionStore } from "../auth/session";
import { OrderCancellationDialog } from "./order-cancellation-dialog";
import { formatOrderDate, formatOrderMoney, OrderStatus, snapshotText } from "./order-presentation";
import { OrdersAccessGate, OrdersHeader } from "./orders-access-gate";
import { useAdministrativeOrder, useOrderMutations } from "./use-administrative-orders";

export function AdministrativeOrderDetailPage({ orderId }: Readonly<{ orderId: string }>) {
  return <OrdersAccessGate><AdministrativeOrderDetail orderId={orderId} /></OrdersAccessGate>;
}

export function AdministrativeOrderDetail({ orderId }: Readonly<{ orderId: string }>) {
  const role = useSessionStore((state) => state.session!.user.role);
  const query = useAdministrativeOrder(orderId);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string }>();
  const mutations = useOrderMutations(
    (message) => { setCancelOpen(false); setCompleteOpen(false); setNotice({ kind: "success", message }); },
    (message) => setNotice({ kind: "error", message }),
  );
  if (query.isPending) return <main className="grid min-h-screen place-items-center"><LoadingState message="Cargando detalle de orden…" /></main>;
  if (query.isError) return <main className="mx-auto min-h-screen max-w-3xl px-6 py-12"><Link className="font-bold text-blue-700 underline" href="/orders">← Órdenes</Link><div className="mt-6"><ErrorState action={<button className="font-bold underline" onClick={() => { void query.refetch(); }} type="button">Reintentar</button>} message={query.error instanceof Error ? query.error.message : "No se pudo cargar la orden."} /></div></main>;
  const order = query.data;
  const canManageOrders = role === "ADMIN" || role === "BILLING";
  const canCancel = canManageOrders && (order.status === "PROCESSING" || order.status === "INVOICED");
  const canComplete = canManageOrders && order.status === "INVOICED";
  const paymentStatus = snapshotText(order.paymentSnapshot, "status");
  const paymentLabel = ({ APPROVED: "Aprobado", REJECTED: "Rechazado", PENDING: "Pendiente" } as Record<string, string>)[paymentStatus] ?? "No registrado";
  return <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8"><div className="mx-auto max-w-6xl">
    <OrdersHeader title="Detalle de orden" description="Expediente histórico y estado operativo vigente de la compra." />
    <div aria-atomic="true" aria-live="polite" className={`min-h-12 py-3 text-sm font-semibold ${notice?.kind === "success" ? "text-emerald-800" : "text-red-800"}`}>{notice?.message}</div>
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 p-6"><div><Link className="text-sm font-bold text-blue-700 underline" href="/orders">← Volver al listado</Link><p className="mb-0 mt-5 break-all font-mono text-sm font-bold">{order.number}</p><p className="mb-0 mt-2 text-sm text-slate-500">Creada {formatOrderDate(order.createdAt)} · Actualizada {formatOrderDate(order.updatedAt)}</p></div><div className="flex flex-wrap items-center gap-3"><OrderStatus status={order.status} />{canComplete ? <button className="rounded-lg border border-emerald-300 px-4 py-2 font-bold text-emerald-800" onClick={() => setCompleteOpen(true)} type="button">Completar</button> : null}{canCancel ? <button className="rounded-lg border border-red-300 px-4 py-2 font-bold text-red-800" onClick={() => setCancelOpen(true)} type="button">Cancelar</button> : null}</div></header>
      {role === "BILLING" && order.status === "PROCESSING" ? <p className="m-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800"><strong>Orden pendiente de facturación.</strong> Puedes administrarla ahora; la conversión atómica a factura se incorporará en el flujo específico de la fase 8.</p> : null}
      {order.cancelledAt ? <p className="m-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Cancelada el {formatOrderDate(order.cancelledAt)}. El pago mostrado es histórico y no representa un reembolso.</p> : null}
      <div className="grid gap-7 p-6 lg:grid-cols-[minmax(0,1fr)_19rem]"><section aria-labelledby="admin-order-lines"><h2 className="text-xl font-bold" id="admin-order-lines">Líneas históricas</h2><div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500"><th className="py-3 pr-4">Producto</th><th className="px-3 py-3">Cantidad</th><th className="px-3 py-3">Precio</th><th className="py-3 pl-3 text-right">Total</th></tr></thead><tbody>{order.items.map((item) => <tr className="border-b border-slate-200" key={item.productId}><td className="py-4 pr-4"><strong>{item.name}</strong><span className="mt-1 block break-all font-mono text-xs text-slate-500">{item.sku}</span></td><td className="px-3 py-4">{item.quantity}</td><td className="px-3 py-4 tabular-nums">{formatOrderMoney(item.unitPrice)}</td><td className="py-4 pl-3 text-right font-bold tabular-nums">{formatOrderMoney(item.lineTotal)}</td></tr>)}</tbody></table></div><p className="mt-4 text-sm text-slate-500">Los datos provienen del snapshot de la orden, no del catálogo vigente.</p></section>
        <aside className="self-start rounded-xl bg-slate-50 p-5"><h2 className="text-lg font-bold">Totales en USD</h2><dl className="mt-5 grid gap-3">{[["Subtotal", order.subtotal], ["Envío", order.shippingTotal], ["Impuestos", order.taxTotal], ["Total", order.total]].map(([label, value]) => <div className={`flex justify-between gap-4 ${label === "Total" ? "border-t border-slate-300 pt-4 text-lg font-bold" : "text-sm"}`} key={label}><dt>{label}</dt><dd className="m-0 tabular-nums">{formatOrderMoney(value!)}</dd></div>)}</dl></aside></div>
      <div className="grid gap-6 border-t border-slate-200 p-6 md:grid-cols-2 xl:grid-cols-3"><section><h2 className="text-lg font-bold">Cliente histórico</h2><p className="mb-0 mt-3">{snapshotText(order.customerSnapshot, "displayName")}</p><p className="mb-0 mt-1 break-all text-sm text-slate-500">{snapshotText(order.customerSnapshot, "email")}</p></section><section><h2 className="text-lg font-bold">Pago histórico</h2><p className="mb-0 mt-3">{paymentLabel}</p><p className="mb-0 mt-1 break-all font-mono text-xs text-slate-500">{snapshotText(order.paymentSnapshot, "providerReference")}</p></section><section><h2 className="text-lg font-bold">Envío histórico</h2><p className="mb-0 mt-3">{snapshotText(order.shippingMethodSnapshot, "name")}</p><p className="mb-0 mt-1 text-sm text-slate-500">{snapshotText(order.shippingAddressSnapshot, "recipientName")} · {snapshotText(order.shippingAddressSnapshot, "line1")}, {snapshotText(order.shippingAddressSnapshot, "city")}</p></section></div>
    </article>
  </div>
  <OrderCancellationDialog isPending={mutations.cancel.isPending} number={order.number} onCancel={() => setCancelOpen(false)} onConfirm={(reason) => { setNotice(undefined); mutations.cancel.mutate({ orderId: order.id, reason }); }} open={cancelOpen} />
  <ConfirmationDialog confirmLabel="Completar orden" description={`La orden ${order.number} quedará completada sin cambiar inventario ni pago.`} isPending={mutations.complete.isPending} onCancel={() => setCompleteOpen(false)} onConfirm={() => { setNotice(undefined); mutations.complete.mutate(order.id); }} open={completeOpen} title="¿Completar esta orden?" />
  </main>;
}
