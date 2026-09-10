"use client";

import { useState } from "react";
import { DataTable, ErrorState, LoadingState, ConfirmationDialog, type DataTableColumn } from "@technology-ecommerce/ui";
import type { AdministrativeOrderPage } from "@technology-ecommerce/api-schemas";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { BackofficePagination } from "../../components/backoffice-pagination";
import { useSessionStore } from "../auth/session";
import { OrderCancellationDialog } from "./order-cancellation-dialog";
import { filtersToSearchParams, parseOrderFilters } from "./order-query";
import { formatOrderDate, formatOrderMoney, OrderStatus, snapshotText, orderStatusLabels } from "./order-presentation";
import { OrdersAccessGate, OrdersHeader } from "./orders-access-gate";
import { useAdministrativeOrders, useOrderMutations } from "./use-administrative-orders";

type OrderRow = AdministrativeOrderPage["items"][number];

export function OrdersManagementPage() {
  return <OrdersAccessGate><OrdersManagement /></OrdersAccessGate>;
}

export function OrdersManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseOrderFilters(new URLSearchParams(searchParams.toString()));
  const role = useSessionStore((state) => state.session!.user.role);
  const canManageOrders = role === "ADMIN" || role === "BILLING";
  const [cancelTarget, setCancelTarget] = useState<OrderRow>();
  const [completeTarget, setCompleteTarget] = useState<OrderRow>();
  const [invoiceTarget, setInvoiceTarget] = useState<OrderRow>();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string }>();
  function mutationSuccess(message: string) { setCancelTarget(undefined); setCompleteTarget(undefined); setInvoiceTarget(undefined); setNotice({ kind: "success", message }); }
  const mutations = useOrderMutations(mutationSuccess, (message) => setNotice({ kind: "error", message }));
  const query = useAdministrativeOrders(filters);

  function navigate(next: Partial<typeof filters>) {
    router.push(`/orders?${filtersToSearchParams({ ...filters, ...next }).toString()}`, { scroll: false });
  }
  function submitSearch(formData: FormData) {
    navigate({ page: 1, search: String(formData.get("search") ?? "").trim() || undefined });
  }
  function submitFilters(formData: FormData) {
    const createdFrom = String(formData.get("createdFrom") ?? "") || undefined;
    const createdTo = String(formData.get("createdTo") ?? "") || undefined;
    const customerId = String(formData.get("customerId") ?? "").trim() || undefined;
    if (createdFrom && createdTo && createdFrom > createdTo) {
      setNotice({ kind: "error", message: "La fecha inicial no puede ser posterior a la fecha final." });
      return;
    }
    if (customerId && !z.uuid().safeParse(customerId).success) {
      setNotice({ kind: "error", message: "El identificador del cliente debe ser un UUID válido." });
      return;
    }
    navigate({
      page: 1, createdFrom, createdTo,
      customerId,
      status: (String(formData.get("status") ?? "") || undefined) as typeof filters.status,
      invoicing: (String(formData.get("invoicing") ?? "") || undefined) as typeof filters.invoicing,
      sortBy: String(formData.get("sortBy") ?? "createdAt") as typeof filters.sortBy,
      sortOrder: String(formData.get("sortOrder") ?? "desc") as typeof filters.sortOrder,
    });
  }

  const columns: readonly DataTableColumn<OrderRow>[] = [
    { id: "order", header: "Orden", cell: (order) => <div><p className="m-0 break-all font-mono text-xs font-bold">{order.number}</p><p className="mb-0 mt-1 text-xs text-slate-500">{formatOrderDate(order.createdAt)}</p></div> },
    { id: "customer", header: "Cliente histórico", cell: (order) => <div><p className="m-0 font-semibold">{snapshotText(order.customerSnapshot, "displayName")}</p><p className="mb-0 mt-1 break-all text-xs text-slate-500">{snapshotText(order.customerSnapshot, "email")}</p></div> },
    { id: "status", header: "Estado", cell: (order) => <OrderStatus status={order.status} /> },
    { id: "total", header: "Total (USD)", cell: (order) => <span className="font-bold tabular-nums">{formatOrderMoney(order.total)}</span> },
    { id: "actions", header: "Acciones", cell: (order) => <div className="flex min-w-56 flex-wrap gap-2"><Link className="rounded-md border border-blue-300 px-3 py-2 font-semibold text-blue-800 hover:bg-blue-50" href={`/orders/${order.id}`}>Ver detalle</Link>{canManageOrders && order.status === "PROCESSING" ? <button className="rounded-md border border-indigo-300 px-3 py-2 font-semibold text-indigo-800 hover:bg-indigo-50" onClick={() => setInvoiceTarget(order)} type="button">Facturar orden</button> : null}{canManageOrders && order.status === "INVOICED" ? <button className="rounded-md border border-emerald-300 px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-50" onClick={() => setCompleteTarget(order)} type="button">Completar</button> : null}{canManageOrders && (order.status === "PROCESSING" || order.status === "INVOICED") ? <button className="rounded-md border border-red-300 px-3 py-2 font-semibold text-red-800 hover:bg-red-50" onClick={() => setCancelTarget(order)} type="button">Cancelar</button> : null}</div> },
  ];

  return <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8"><div className="mx-auto max-w-[90rem]">
    <OrdersHeader title="Órdenes" description={role === "BILLING" ? "Gestiona pedidos y prepara su facturación conforme al estado operativo." : "Consulta, completa o cancela pedidos conforme a su estado operativo."} />
    <div aria-atomic="true" aria-live="polite" className={`min-h-12 py-3 text-sm font-semibold ${notice?.kind === "success" ? "text-emerald-800" : "text-red-800"}`}>{notice?.message}</div>
    <form className="mb-5 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4" key={`search-${filters.search ?? ""}`} onSubmit={(event) => { event.preventDefault(); submitSearch(new FormData(event.currentTarget)); }}><label className="sr-only" htmlFor="order-search">Buscar órdenes</label><input className="min-h-11 min-w-56 flex-1 rounded-lg border border-slate-300 px-4" defaultValue={filters.search} id="order-search" maxLength={200} name="search" placeholder="Número, nombre o correo del cliente" /><button className="rounded-lg bg-[#15345b] px-5 py-2 font-bold text-white" type="submit">Buscar</button>{filters.search ? <Link className="self-center font-bold text-blue-700 underline" href={`/orders?${filtersToSearchParams({ ...filters, page: 1, search: undefined })}`}>Limpiar búsqueda</Link> : null}</form>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section aria-labelledby="orders-list-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold" id="orders-list-title">Listado operativo</h2><p className="m-0 text-sm text-slate-600">{query.data ? `${query.data.totalItems} órdenes` : "Consultando órdenes"}</p></div>
        {query.isPending ? <LoadingState message="Cargando órdenes…" /> : query.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => { void query.refetch(); }} type="button">Reintentar</button>} message={query.error instanceof Error ? query.error.message : "No se pudieron cargar las órdenes."} /> : <><DataTable caption="Órdenes administrativas" columns={columns} emptyMessage="No hay órdenes que coincidan con los criterios." rowKey={(order) => order.id} rows={query.data.items} />{query.data.totalPages > 0 && filters.page <= query.data.totalPages ? <div className="mt-5"><BackofficePagination page={query.data.page} totalPages={query.data.totalPages} /></div> : filters.page > 1 ? <div className="mt-5 text-center"><button className="font-bold text-blue-700 underline" onClick={() => navigate({ page: 1 })} type="button">Volver a la primera página</button></div> : null}</>}
      </section>
      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" open><summary className="cursor-pointer font-bold">Filtros y orden</summary><form className="mt-5 grid gap-4" key={`filters-${searchParams.toString()}`} onSubmit={(event) => { event.preventDefault(); submitFilters(new FormData(event.currentTarget)); }}>
        <label className="grid gap-1 text-sm font-semibold">Estado<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.status ?? ""} name="status"><option value="">Todos</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-semibold">Facturación<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.invoicing ?? ""} name="invoicing"><option value="">Todas</option><option value="ACTIVE_INVOICE">Con factura activa</option><option value="NO_ACTIVE_INVOICE">Sin factura activa</option></select></label>
        <label className="grid gap-1 text-sm font-semibold">Desde<input className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.createdFrom} name="createdFrom" type="date" /></label><label className="grid gap-1 text-sm font-semibold">Hasta<input className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.createdTo} name="createdTo" type="date" /></label>
        <label className="grid gap-1 text-sm font-semibold">ID de cliente<input className="min-h-11 rounded-lg border border-slate-300 px-3 font-mono text-xs" defaultValue={filters.customerId} name="customerId" placeholder="UUID exacto" /></label>
        <label className="grid gap-1 text-sm font-semibold">Ordenar por<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortBy} name="sortBy"><option value="createdAt">Fecha</option><option value="number">Número</option><option value="total">Total</option><option value="status">Estado</option></select></label><label className="grid gap-1 text-sm font-semibold">Dirección<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortOrder} name="sortOrder"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label>
        <button className="min-h-11 rounded-lg bg-[#15345b] px-4 font-bold text-white" type="submit">Aplicar filtros</button><Link className="text-center font-bold text-blue-700 underline" href="/orders">Restablecer</Link>
      </form></details>
    </div>
  </div>
  <OrderCancellationDialog isPending={mutations.cancel.isPending} number={cancelTarget?.number ?? ""} onCancel={() => setCancelTarget(undefined)} onConfirm={(reason) => { setNotice(undefined); if (cancelTarget) mutations.cancel.mutate({ orderId: cancelTarget.id, reason }); }} open={Boolean(cancelTarget)} />
  <ConfirmationDialog confirmLabel="Facturar orden" description={invoiceTarget ? `La orden ${invoiceTarget.number} se convertirá en factura y quedará marcada como facturada.` : ""} isPending={mutations.invoice.isPending} onCancel={() => setInvoiceTarget(undefined)} onConfirm={() => { setNotice(undefined); if (invoiceTarget) mutations.invoice.mutate(invoiceTarget.id); }} open={Boolean(invoiceTarget)} title="¿Convertir esta orden en factura?" />
  <ConfirmationDialog confirmLabel="Completar orden" description={completeTarget ? `La orden ${completeTarget.number} quedará completada. El inventario y el pago no cambiarán.` : ""} isPending={mutations.complete.isPending} onCancel={() => setCompleteTarget(undefined)} onConfirm={() => { setNotice(undefined); if (completeTarget) mutations.complete.mutate(completeTarget.id); }} open={Boolean(completeTarget)} title="¿Completar esta orden?" />
  </main>;
}
