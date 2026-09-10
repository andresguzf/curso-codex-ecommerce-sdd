"use client";

import { LoadingState, Pagination } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { formatInvoiceDate, formatInvoiceMoney, InvoiceStatus } from "./invoice-presentation";
import { CustomerInvoicesApiError } from "./invoice-api";
import { InvoicesAccessGate } from "./invoices-access-gate";
import { useMyInvoices } from "./use-invoices";

function validPage(value: string | null) {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 && page <= 1_000_000 ? page : 1;
}

export function InvoicesPage() {
  const params = useSearchParams();
  const returnTo = `/account/invoices${params.size ? `?${params}` : ""}`;
  return <InvoicesAccessGate returnTo={returnTo}><InvoicesList /></InvoicesAccessGate>;
}

export function InvoicesList() {
  const params = useSearchParams();
  const router = useRouter();
  const page = validPage(params.get("page"));
  const query = useMyInvoices({ page, pageSize: 20 });

  function navigate(nextPage: number) {
    router.push(`/account/invoices?page=${nextPage}`);
  }

  return <>
    <Link href="/account" className="text-sm font-bold text-blue-700 underline">← Volver a mi cuenta</Link>
    <header className="my-8"><p className="text-sm font-bold uppercase tracking-widest text-blue-700">Tu cuenta · Documentos</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Mis facturas</h1><p className="mt-3 text-slate-600">Consulta únicamente las facturas emitidas para tu cuenta.</p></header>
    {query.isPending ? <LoadingState message="Cargando tus facturas…" /> : query.isError ? <InvoiceListError error={query.error} retry={() => { void query.refetch(); }} returnTo={`/account/invoices?page=${page}`} /> : <>
      <p role="status" className="mb-4 text-sm text-slate-600">{query.data.totalItems} facturas encontradas</p>
      {!query.data.items.length ? <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="text-2xl font-bold">Aún no tienes facturas</h2><p className="my-4 text-slate-600">Aquí aparecerán tus facturas cuando una compra sea facturada.</p><Link href="/account/orders" className="font-bold text-blue-700 underline">Ver mis compras</Link></section>
        : <ol className="mb-8 grid list-none gap-4 p-0">{query.data.items.map((invoice) => <li key={invoice.id}><article className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6"><div className="min-w-0"><p className="mb-2 text-sm text-slate-600"><time dateTime={invoice.createdAt}>{formatInvoiceDate(invoice.createdAt)}</time></p><h2 className="break-all font-mono text-sm font-bold">{invoice.number ?? "Borrador sin número"}</h2><div className="mt-3"><InvoiceStatus status={invoice.status} /></div></div><div className="flex flex-wrap items-center gap-6"><p className="text-xl font-black tabular-nums">{formatInvoiceMoney(invoice.total)} <span className="text-xs text-slate-600">USD</span></p><Link href={`/account/invoices/${invoice.id}`} aria-label={`Ver factura ${invoice.number ?? invoice.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">Ver factura →</Link></div></article></li>)}</ol>}
      {query.data.totalPages > 0 && page <= query.data.totalPages ? <Pagination page={page} totalPages={query.data.totalPages} onPageChange={navigate} /> : null}
    </>}
  </>;
}

function InvoiceListError({ error, retry, returnTo }: Readonly<{ error: unknown; retry: () => void; returnTo: string }>) {
  const status = error instanceof CustomerInvoicesApiError ? error.status : 0;
  return <section className="my-8 rounded-2xl border border-slate-200 bg-white p-6"><p role="alert">{error instanceof CustomerInvoicesApiError ? error.message : "No se pudieron cargar tus facturas. Revisa tu conexión y vuelve a intentarlo."}</p><div className="mt-4 flex flex-wrap gap-5 font-bold text-blue-700">{status === 401 ? <Link className="underline" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Iniciar sesión</Link> : status !== 403 && status !== 404 ? <button type="button" className="underline" onClick={retry}>Reintentar</button> : null}<Link href="/account" className="underline">Volver a mi cuenta</Link></div></section>;
}
