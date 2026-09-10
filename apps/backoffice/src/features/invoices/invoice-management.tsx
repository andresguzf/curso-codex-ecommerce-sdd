"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvoiceStatus, InvoiceSummary } from "@technology-ecommerce/api-schemas";
import { CollapsibleSidePanel, ConfirmationDialog, DataTable, ErrorState, Icon, IconButton, LoadingState, type DataTableColumn } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { BackofficePagination } from "../../components/backoffice-pagination";
import { backofficeDestinationFor, isBackofficeRole, useSessionStore } from "../auth/session";
import { createManualInvoice, changeInvoiceStatus, invoiceOrder, listInvoices, InvoiceApiError } from "./invoice-api";
import { invoiceFiltersToSearchParams, parseInvoiceFilters } from "./invoice-query";
import { formatInvoiceDate, formatInvoiceMoney, invoiceStatusLabels, InvoiceStatus as InvoiceStatusBadge, snapshotText } from "./invoice-presentation";
import { ManualInvoiceForm } from "./manual-invoice-form";

export const invoicesQueryRoot = ["backoffice", "invoices"] as const;

function InvoiceAccessGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { session, status } = useSessionStore();
  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (session && !isBackofficeRole(session.user.role)) window.location.assign(backofficeDestinationFor(session.user.role));
  }, [router, session, status]);
  if (status !== "authenticated" || !session) return <main className="grid min-h-screen place-items-center"><LoadingState message="Validando acceso a facturación…" /></main>;
  if (!isBackofficeRole(session.user.role)) return <main className="grid min-h-screen place-items-center"><ErrorState title="Acceso restringido" message="Esta sección requiere un rol administrativo." /></main>;
  return children;
}

export function InvoicesManagementPage() {
  return <InvoiceAccessGate><InvoicesManagement /></InvoiceAccessGate>;
}

function nextStatus(status: InvoiceStatus): InvoiceStatus | undefined {
  if (status === "DRAFT") return "PENDING_PAYMENT";
  if (status === "PENDING_PAYMENT") return "PAID";
  if (status === "PAID") return "VOID";
  return undefined;
}

export function InvoicesManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseInvoiceFilters(new URLSearchParams(searchParams.toString()));
  const session = useSessionStore((state) => state.session)!;
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string }>();
  const [manualOpen, setManualOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<InvoiceSummary>();
  const [orderId, setOrderId] = useState("");
  const client = useQueryClient();
  const query = useQuery({ queryKey: [...invoicesQueryRoot, session.user.id, "list", filters], queryFn: ({ signal }) => listInvoices(session.accessToken, filters, signal) });
  const invalidate = async () => { await client.invalidateQueries({ queryKey: invoicesQueryRoot }); };
  const manualMutation = useMutation({ mutationFn: (input: Parameters<typeof createManualInvoice>[1]) => createManualInvoice(session.accessToken, input), onSuccess: async () => { await invalidate(); setManualOpen(false); setNotice({ kind: "success", message: "Factura manual creada como borrador." }); }, onError: (error: Error) => setNotice({ kind: "error", message: error.message }) });
  const orderMutation = useMutation({ mutationFn: (id: string) => invoiceOrder(session.accessToken, id), onSuccess: async (invoice) => { await invalidate(); setOrderId(""); setNotice({ kind: "success", message: `Orden convertida en factura ${invoice.number ?? ""}.` }); }, onError: (error: Error) => setNotice({ kind: "error", message: error.message }) });
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) => changeInvoiceStatus(session.accessToken, id, { status }), onSuccess: async (_invoice, variables) => { await invalidate(); setVoidTarget(undefined); setNotice({ kind: "success", message: `Factura ${invoiceStatusLabels[variables.status].toLowerCase()} correctamente.` }); }, onError: (error: Error) => setNotice({ kind: "error", message: error.message }) });

  function navigate(next: Partial<typeof filters>) { router.push(`/invoices?${invoiceFiltersToSearchParams({ ...filters, ...next }).toString()}`, { scroll: false }); }
  function submitSearch(formData: FormData) { navigate({ page: 1, search: String(formData.get("search") ?? "").trim() || undefined }); }
  function submitFilters(formData: FormData) {
    const createdFrom = String(formData.get("createdFrom") ?? "") || undefined;
    const createdTo = String(formData.get("createdTo") ?? "") || undefined;
    if (createdFrom && createdTo && createdFrom > createdTo) { setNotice({ kind: "error", message: "La fecha inicial no puede ser posterior a la fecha final." }); return; }
    const customerId = String(formData.get("customerId") ?? "").trim() || undefined;
    if (customerId && !z.uuid().safeParse(customerId).success) { setNotice({ kind: "error", message: "El identificador del cliente debe ser un UUID válido." }); return; }
    navigate({ page: 1, createdFrom, createdTo, customerId, status: (String(formData.get("status") ?? "") || undefined) as typeof filters.status, origin: (String(formData.get("origin") ?? "") || undefined) as typeof filters.origin, sortBy: String(formData.get("sortBy") ?? "createdAt") as typeof filters.sortBy, sortOrder: String(formData.get("sortOrder") ?? "desc") as typeof filters.sortOrder });
    setFiltersOpen(false);
  }
  function submitOrder(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const parsed = z.uuid().safeParse(orderId.trim()); if (!parsed.success) { setNotice({ kind: "error", message: "Indica un ID de orden válido." }); return; } setNotice(undefined); orderMutation.mutate(parsed.data); }

  const columns: readonly DataTableColumn<InvoiceSummary>[] = [
    { id: "invoice", header: "Factura", cell: (invoice) => <div><p className="m-0 break-all font-mono text-xs font-bold">{invoice.number ?? "Borrador sin número"}</p><p className="mb-0 mt-1 text-xs text-slate-500">{formatInvoiceDate(invoice.createdAt)}</p></div> },
    { id: "customer", header: "Cliente", cell: (invoice) => <div><p className="m-0 font-semibold">{snapshotText(invoice.customerSnapshot, "displayName")}</p><p className="mb-0 mt-1 break-all text-xs text-slate-500">{snapshotText(invoice.customerSnapshot, "email")}</p></div> },
    { id: "origin", header: "Origen", cell: (invoice) => invoice.origin === "ORDER" ? "Orden" : "Manual" },
    { id: "status", header: "Estado", cell: (invoice) => <InvoiceStatusBadge status={invoice.status} /> },
    { id: "total", header: "Total (USD)", cell: (invoice) => <span className="font-bold tabular-nums">{formatInvoiceMoney(invoice.total)}</span> },
    { id: "actions", header: "Acciones", cell: (invoice) => <div className="flex min-w-40 flex-wrap gap-2"><Link aria-label="Ver detalle" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-300 text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href={`/invoices/${invoice.id}`} title="Ver detalle"><Icon name="eye" /></Link>{nextStatus(invoice.status) && nextStatus(invoice.status) !== "VOID" ? <IconButton className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 focus-visible:ring-emerald-700" disabled={statusMutation.isPending} icon={invoice.status === "DRAFT" ? "file-invoice" : "check"} label={invoice.status === "DRAFT" ? "Emitir" : "Marcar pagada"} onClick={() => statusMutation.mutate({ id: invoice.id, status: nextStatus(invoice.status)! })} /> : null}{nextStatus(invoice.status) === "VOID" ? <IconButton className="border-red-300 text-red-800 hover:bg-red-50 focus-visible:ring-red-700" icon="trash" label="Anular" onClick={() => setVoidTarget(invoice)} /> : null}</div> },
  ];

  return <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8"><div className="mx-auto max-w-[90rem]"><header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-300 pb-6"><div><Link className="text-sm font-bold text-blue-800 hover:underline" href="/">← Panel principal</Link><p className="mb-0 mt-5 text-xs font-bold uppercase tracking-[.18em] text-blue-800">Operaciones · {session.user.role === "ADMIN" ? "Administración" : "Facturación"}</p><h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Facturas</h1><p className="mb-0 mt-2 max-w-2xl text-slate-600">Consulta, emite y administra facturas independientes de las órdenes.</p></div><div className="flex flex-wrap items-center gap-3"><IconButton className="border-blue-300 text-blue-800 hover:bg-blue-50 focus-visible:ring-blue-700" icon={manualOpen ? "x" : "plus"} label={manualOpen ? "Cerrar formulario" : "Nueva factura manual"} onClick={() => { setManualOpen((open) => !open); setNotice(undefined); }} /><form className="flex gap-2" onSubmit={submitOrder}><label className="sr-only" htmlFor="invoice-order-id">ID de orden</label><input className="min-h-11 w-64 rounded-lg border border-slate-300 px-3 font-mono text-xs" id="invoice-order-id" onChange={(event) => setOrderId(event.target.value)} placeholder="UUID de orden a facturar" value={orderId} /><IconButton className="border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800 focus-visible:ring-blue-700" disabled={orderMutation.isPending} icon="file-invoice" label={orderMutation.isPending ? "Facturando…" : "Facturar orden"} type="submit" /></form></div></header><div aria-atomic="true" aria-live="polite" className={`min-h-12 py-3 text-sm font-semibold ${notice?.kind === "success" ? "text-emerald-800" : "text-red-800"}`}>{notice?.message}</div>
    {manualOpen ? <section aria-labelledby="manual-invoice-title" className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="m-0 text-xs font-bold uppercase tracking-[.16em] text-blue-800">Alta administrativa</p><h2 className="mb-0 mt-2 text-2xl font-bold" id="manual-invoice-title">Factura manual</h2><p className="mb-6 mt-2 text-sm text-slate-600">Se crea como borrador y nunca modifica inventario. Los productos pueden agregarse por ID hasta habilitar el autocomplete remoto.</p><ManualInvoiceForm isPending={manualMutation.isPending} onCancel={() => setManualOpen(false)} onSubmit={(input) => { setNotice(undefined); manualMutation.mutate(input); }} /></section> : null}
    <form className="mb-5 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4" key={`search-${filters.search ?? ""}`} onSubmit={(event) => { event.preventDefault(); submitSearch(new FormData(event.currentTarget)); }}><label className="sr-only" htmlFor="invoice-search">Buscar facturas</label><input className="min-h-11 min-w-56 flex-1 rounded-lg border border-slate-300 px-4" defaultValue={filters.search} id="invoice-search" maxLength={200} name="search" placeholder="Número o cliente histórico" /><button className="rounded-lg bg-[#15345b] px-5 py-2 font-bold text-white" type="submit">Buscar</button>{filters.search ? <Link className="self-center font-bold text-blue-700 underline" href={`/invoices?${invoiceFiltersToSearchParams({ ...filters, page: 1, search: undefined })}`}>Limpiar búsqueda</Link> : null}</form>
    <div className="flex items-stretch gap-2"><section aria-labelledby="invoice-list-title" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold" id="invoice-list-title">Listado de facturación</h2><p className="m-0 text-sm text-slate-600">{query.data ? `${query.data.totalItems} facturas` : "Consultando facturas"}</p></div>{query.isPending ? <LoadingState message="Cargando facturas…" /> : query.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => { void query.refetch(); }} type="button">Reintentar</button>} message={query.error instanceof InvoiceApiError ? query.error.message : "No se pudieron cargar las facturas."} /> : <><DataTable caption="Facturas administrativas" columns={columns} emptyMessage="No hay facturas que coincidan con los criterios." rowKey={(invoice) => invoice.id} rows={query.data.items} />{query.data.totalPages > 0 && filters.page <= query.data.totalPages ? <div className="mt-5"><BackofficePagination page={query.data.page} totalPages={query.data.totalPages} /></div> : null}</>}</section><div className="flex shrink-0 items-center"><IconButton ariaExpanded={filtersOpen} className="border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:ring-blue-700" icon={filtersOpen ? "chevron-left" : "chevron-right"} label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"} onClick={() => setFiltersOpen((open) => !open)} /></div><CollapsibleSidePanel onClose={() => setFiltersOpen(false)} open={filtersOpen} title="Filtros y orden de facturas"><form className="grid gap-4" key={`filters-${searchParams.toString()}`} onSubmit={(event) => { event.preventDefault(); submitFilters(new FormData(event.currentTarget)); }}><label className="grid gap-1 text-sm font-semibold">Estado<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.status ?? ""} name="status"><option value="">Todos</option>{Object.entries(invoiceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Origen<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.origin ?? ""} name="origin"><option value="">Todos</option><option value="MANUAL">Manual</option><option value="ORDER">Orden</option></select></label><label className="grid gap-1 text-sm font-semibold">Desde<input className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.createdFrom} name="createdFrom" type="date" /></label><label className="grid gap-1 text-sm font-semibold">Hasta<input className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.createdTo} name="createdTo" type="date" /></label><label className="grid gap-1 text-sm font-semibold">ID de cliente<input className="min-h-11 rounded-lg border border-slate-300 px-3 font-mono text-xs" defaultValue={filters.customerId} name="customerId" placeholder="UUID exacto" /></label><label className="grid gap-1 text-sm font-semibold">Ordenar por<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortBy} name="sortBy"><option value="createdAt">Fecha</option><option value="number">Número</option><option value="total">Total</option><option value="status">Estado</option><option value="origin">Origen</option></select></label><label className="grid gap-1 text-sm font-semibold">Dirección<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortOrder} name="sortOrder"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label><button className="min-h-11 rounded-lg bg-[#15345b] px-4 font-bold text-white" type="submit">Aplicar filtros</button><Link className="text-center font-bold text-blue-700 underline" href="/invoices" onClick={() => setFiltersOpen(false)}>Restablecer</Link></form></CollapsibleSidePanel></div></div><ConfirmationDialog confirmLabel="Anular factura" description={voidTarget ? `La factura ${voidTarget.number ?? "sin número"} quedará anulada y conservará su historial.` : ""} isPending={statusMutation.isPending} onCancel={() => setVoidTarget(undefined)} onConfirm={() => { if (voidTarget) statusMutation.mutate({ id: voidTarget.id, status: "VOID" }); }} open={Boolean(voidTarget)} title="¿Anular esta factura?" /></main>;
}
