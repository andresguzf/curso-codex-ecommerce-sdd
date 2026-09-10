"use client";

import type { CustomerOrderDetail } from "@technology-ecommerce/api-schemas";
import { LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useSessionStore } from "../auth/session";
import { formatProductPrice } from "../catalog/catalog-format";
import { downloadMyOrderPdf } from "./orders-api";
import { PdfDownloadButton } from "../documents/pdf-download-button";
import { OrdersAccessGate } from "./orders-access-gate";
import { orderDate, OrdersError, OrderStatus } from "./order-presentation";
import { useMyOrder } from "./use-orders";

export function OrderDetailPage({ orderId }: Readonly<{ orderId: string }>) {
  return <OrdersAccessGate returnTo={`/account/orders/${orderId}`}><OrderDetail orderId={orderId} /></OrdersAccessGate>;
}

export function OrderDetail({ orderId }: Readonly<{ orderId: string }>) {
  const accessToken = useSessionStore((state) => state.session?.accessToken);
  const query = useMyOrder(orderId);
  if (query.isPending) return <LoadingState message="Cargando tu pedido…" />;
  if (query.isError) return <OrdersError error={query.error} retry={() => { void query.refetch(); }} returnTo={`/account/orders/${orderId}`} />;
  const order = query.data;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-4"><Link href="/account/orders" className="font-bold text-blue-700 underline">← Mis compras</Link>{accessToken ? <PdfDownloadButton onDownload={() => downloadMyOrderPdf(accessToken, orderId)} /> : null}</div>
    <article className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 p-6 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Detalle de tu pedido</h1><OrderStatus status={order.status} /></div>
        <p className="mt-4 break-all font-mono text-sm font-bold">{order.number}</p>
        <p className="mt-2 text-sm text-slate-600">Realizado el <time dateTime={order.createdAt}>{orderDate(order.createdAt)}</time> · Actualizado el <time dateTime={order.updatedAt}>{orderDate(order.updatedAt)}</time></p>
        {order.cancelledAt && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">Cancelado el {orderDate(order.cancelledAt)}. El pago que aparece abajo es el registro original; la cancelación no representa un reembolso.</p>}
      </header>
      <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="order-products"><h2 id="order-products" className="text-xl font-bold">Productos de tu compra</h2>
          <ul className="my-6 grid list-none gap-5 p-0">{order.items.map((item) => <li key={item.productId} className="border-b border-slate-200 pb-5">
            <h3 className="break-words font-bold">{item.name}</h3><p className="my-2 break-all font-mono text-xs text-slate-600">SKU: {item.sku}</p>
            <div className="flex flex-wrap justify-between gap-3 text-sm"><span>{item.quantity} × {formatProductPrice(item.unitPrice)}</span><span className="font-bold">{formatProductPrice(item.lineTotal)}</span></div>
            <p className="mt-2 text-xs text-slate-600">Impuestos de la línea: {formatProductPrice(item.taxAmount)}</p>
          </li>)}</ul>
          <p className="text-sm text-slate-600">Nombres, precios y datos guardados al realizar la compra. Los cambios del catálogo no modifican este pedido.</p>
        </section>
        <aside aria-labelledby="order-totals" className="self-start rounded-2xl bg-slate-50 p-5"><h2 id="order-totals" className="mb-5 text-xl font-bold">Resumen en USD</h2><dl className="grid gap-4">{[["Subtotal", order.subtotal], ["Envío", order.shippingTotal], ["Impuestos", order.taxTotal], ["Total", order.total]].map(([label, value]) => <div key={label} className={`flex flex-wrap justify-between gap-3 ${label === "Total" ? "border-t border-slate-200 pt-4 text-xl font-black" : "text-sm"}`}><dt>{label}</dt><dd className="m-0 tabular-nums">{formatProductPrice(value!)}</dd></div>)}</dl></aside>
      </div>
      <OrderSnapshots order={order} />
    </article>
  </>;
}

// Render only recognized historical fields, never arbitrary JSON or current
// profile/catalog values. Older incomplete snapshots have explicit fallbacks.
function text(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value : "No registrado";
}

function OrderSnapshots({ order }: Readonly<{ order: CustomerOrderDetail }>) {
  const address = order.shippingAddressSnapshot;
  const payment = order.paymentSnapshot;
  const paymentStatus = text(payment, "status");
  const statusLabel = ({ APPROVED: "Aprobado", REJECTED: "Rechazado", PENDING: "Pendiente" } as Record<string, string>)[paymentStatus] ?? "No registrado";
  const paymentMethod = text(payment, "method");
  return <div className="grid gap-7 border-t border-slate-200 p-6 sm:grid-cols-2 sm:p-9">
    <section><h2 className="mb-3 text-xl font-bold">Cliente al comprar</h2><p className="break-words">{text(order.customerSnapshot, "displayName")}</p><p className="break-all text-sm text-slate-600">{text(order.customerSnapshot, "email")}</p></section>
    <section><h2 className="mb-3 text-xl font-bold">Pago original</h2><p>{statusLabel} · {paymentMethod === "SIMULATED_CARD_APPROVED" || paymentMethod === "SIMULATED_CARD_REJECTED" ? "Tarjeta simulada" : "Método no registrado"}</p><p className="mt-2 break-all font-mono text-xs text-slate-600">Referencia: {text(payment, "providerReference")}</p><p className="mt-2 text-sm text-slate-600">No se realizó un cobro real. El estado del pago es independiente del pedido.</p></section>
    <section><h2 className="mb-3 text-xl font-bold">Dirección registrada</h2><address className="break-words not-italic leading-relaxed">{text(address, "recipientName")}<br />{text(address, "line1")}{typeof address.line2 === "string" && address.line2 && <><br />{address.line2}</>}<br />{text(address, "city")}, {text(address, "region")}<br />{text(address, "postalCode")} · {text(address, "countryCode")}</address></section>
    <section><h2 className="mb-3 text-xl font-bold">Envío elegido</h2><p>{text(order.shippingMethodSnapshot, "name")}</p><p className="mt-2 text-sm text-slate-600">Costo al comprar: {formatProductPrice(order.shippingTotal)} USD</p><p className="mt-2 text-sm text-slate-600">Servicio simulado; no representa seguimiento de un despacho real.</p></section>
  </div>;
}
