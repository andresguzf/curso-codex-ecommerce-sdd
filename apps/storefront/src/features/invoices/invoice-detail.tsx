"use client";

import { LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";

import { CustomerInvoicesApiError } from "./invoice-api";
import { InvoicesAccessGate } from "./invoices-access-gate";
import { formatInvoiceDate, formatInvoiceMoney, InvoiceStatus, snapshotText } from "./invoice-presentation";
import { useMyInvoice } from "./use-invoices";

export function InvoiceDetailPage({ invoiceId }: Readonly<{ invoiceId: string }>) {
  return <InvoicesAccessGate returnTo={`/account/invoices/${invoiceId}`}><InvoiceDetail invoiceId={invoiceId} /></InvoicesAccessGate>;
}

export function InvoiceDetail({ invoiceId }: Readonly<{ invoiceId: string }>) {
  const query = useMyInvoice(invoiceId);
  if (query.isPending) return <LoadingState message="Cargando tu factura…" />;
  if (query.isError) return <InvoiceDetailError error={query.error} retry={() => { void query.refetch(); }} invoiceId={invoiceId} />;
  const invoice = query.data;
  return <>
    <Link href="/account/invoices" className="font-bold text-blue-700 underline">← Mis facturas</Link>
    <article className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 p-6 sm:p-9"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="break-all font-mono text-sm font-bold">{invoice.number ?? "Borrador sin número"}</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Detalle de factura</h1></div><InvoiceStatus status={invoice.status} /></div><p className="mt-4 text-sm text-slate-600">Creada el <time dateTime={invoice.createdAt}>{formatInvoiceDate(invoice.createdAt)}</time>{invoice.issuedAt ? <> · Emitida el <time dateTime={invoice.issuedAt}>{formatInvoiceDate(invoice.issuedAt)}</time></> : null}</p></header>
      <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_18rem]"><section aria-labelledby="invoice-lines"><h2 id="invoice-lines" className="text-xl font-bold">Productos facturados</h2><ul className="my-6 grid list-none gap-5 p-0">{invoice.lines.map((line) => <li key={line.position} className="border-b border-slate-200 pb-5"><h3 className="break-words font-bold">{line.nameSnapshot}</h3><p className="my-2 break-all font-mono text-xs text-slate-600">{line.skuSnapshot ?? "Línea manual"}</p><div className="flex flex-wrap justify-between gap-3 text-sm"><span>{line.quantity} × {formatInvoiceMoney(line.unitPrice)}</span><span className="font-bold">{formatInvoiceMoney(line.lineTotal)}</span></div><p className="mt-2 text-xs text-slate-600">Impuestos de la línea: {formatInvoiceMoney(line.taxAmount)}</p></li>)}</ul><p className="text-sm text-slate-600">Los datos mostrados corresponden al momento de emitir la factura y no cambian con el catálogo actual.</p></section><aside aria-labelledby="invoice-totals" className="self-start rounded-2xl bg-slate-50 p-5"><h2 id="invoice-totals" className="mb-5 text-xl font-bold">Resumen en USD</h2><dl className="grid gap-4">{[["Subtotal", invoice.subtotal], ["Envío", invoice.shippingTotal], ["Impuestos", invoice.taxTotal], ["Total", invoice.total]].map(([label, value]) => <div key={label} className={`flex flex-wrap justify-between gap-3 ${label === "Total" ? "border-t border-slate-200 pt-4 text-xl font-black" : "text-sm"}`}><dt>{label}</dt><dd className="m-0 tabular-nums">{formatInvoiceMoney(value)}</dd></div>)}</dl></aside></div>
      <div className="grid gap-7 border-t border-slate-200 p-6 sm:grid-cols-2 sm:p-9"><section><h2 className="mb-3 text-xl font-bold">Cliente facturado</h2><p className="break-words">{snapshotText(invoice.customerSnapshot, "displayName")}</p><p className="break-all text-sm text-slate-600">{snapshotText(invoice.customerSnapshot, "email")}</p></section><section><h2 className="mb-3 text-xl font-bold">Origen</h2><p>{invoice.origin === "ORDER" ? "Orden de compra" : "Factura manual"}</p><p className="mt-2 break-all font-mono text-xs text-slate-600">{invoice.orderId ?? "Sin orden asociada"}</p></section></div>
    </article>
  </>;
}

function InvoiceDetailError({ error, retry, invoiceId }: Readonly<{ error: unknown; retry: () => void; invoiceId: string }>) {
  const status = error instanceof CustomerInvoicesApiError ? error.status : 0;
  return <section className="my-8 rounded-2xl border border-slate-200 bg-white p-6"><p role="alert">{error instanceof CustomerInvoicesApiError ? error.message : "No se pudo cargar esta factura. Revisa tu conexión y vuelve a intentarlo."}</p><div className="mt-4 flex flex-wrap gap-5 font-bold text-blue-700">{status === 401 ? <Link className="underline" href={`/login?returnTo=${encodeURIComponent(`/account/invoices/${invoiceId}`)}`}>Iniciar sesión</Link> : status !== 403 && status !== 404 ? <button type="button" className="underline" onClick={retry}>Reintentar</button> : null}<Link href="/account/invoices" className="underline">Volver a mis facturas</Link></div></section>;
}
