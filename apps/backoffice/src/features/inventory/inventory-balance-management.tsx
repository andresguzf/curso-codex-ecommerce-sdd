"use client";

import { useQuery } from "@tanstack/react-query";
import type { InventoryBalance } from "@technology-ecommerce/api-schemas";
import { DataTable, ErrorState, Icon, LoadingState, type DataTableColumn } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BackofficeListLayout, BackofficeListSearch } from "../../components/backoffice-list-layout";
import { BackofficePagination } from "../../components/backoffice-pagination";
import { useSessionStore } from "../auth/session";
import { InventoryApiError, listInventoryBalances } from "./inventory-api";
import { inventoryBalanceFiltersToParams, parseInventoryBalanceFilters, type InventoryBalanceFilters } from "./inventory-query";

const inventoryBalancesKey = ["backoffice", "inventory-balances"] as const;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function InventoryBalanceManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseInventoryBalanceFilters(new URLSearchParams(searchParams.toString()));
  const { session, status } = useSessionStore();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const accessToken = session?.accessToken ?? "";
  const isAdmin = status === "authenticated" && session?.user.role === "ADMIN";

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [router, status]);

  const balancesQuery = useQuery({
    enabled: isAdmin,
    queryFn: ({ signal }) => listInventoryBalances(accessToken, filters, signal),
    queryKey: [...inventoryBalancesKey, filters],
  });

  function navigate(updates: Partial<InventoryBalanceFilters>) {
    const params = inventoryBalanceFiltersToParams({ ...filters, ...updates });
    router.push(`/inventory?${params.toString()}`, { scroll: false });
  }

  function applyFilters(formData: FormData) {
    navigate({
      page: 1,
      pageSize: Number(formData.get("pageSize") ?? 20),
      status: (String(formData.get("status") ?? "") || undefined) as InventoryBalanceFilters["status"],
      availability: (String(formData.get("availability") ?? "") || undefined) as InventoryBalanceFilters["availability"],
      sortBy: String(formData.get("sortBy") ?? "updatedAt") as InventoryBalanceFilters["sortBy"],
      sortOrder: String(formData.get("sortOrder") ?? "desc") as InventoryBalanceFilters["sortOrder"],
    });
    setFiltersOpen(false);
  }

  const columns: readonly DataTableColumn<InventoryBalance>[] = [
    {
      id: "product",
      header: "Producto",
      cell: (balance) => (
        <div>
          <p className="m-0 font-bold text-slate-950">{balance.name}</p>
          <p className="m-0 mt-1 font-mono text-xs text-slate-500">{balance.sku}</p>
        </div>
      ),
    },
    {
      id: "availability",
      header: "Unidades disponibles",
      cell: (balance) => <span className="font-mono text-lg font-black tabular-nums">{balance.availableQuantity}</span>,
    },
    {
      id: "status",
      header: "Estado del producto",
      cell: (balance) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${balance.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
          {balance.status === "ACTIVE" ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    { id: "updatedAt", header: "Última actualización", cell: (balance) => <time dateTime={balance.updatedAt}>{formatDate(balance.updatedAt)}</time> },
    {
      id: "actions",
      header: "Acciones",
      cell: (balance) => (
        <Link
          aria-label={`Ver movimientos de ${balance.name}`}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-blue-300 text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          href={`/products/${balance.productId}/inventory`}
          title="Ver movimientos y ajustar inventario"
        >
          <Icon name="eye" />
        </Link>
      ),
    },
  ];

  if (status === "initializing" || (status === "authenticated" && !session)) {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Validando acceso…" /></main>;
  }
  if (status === "anonymous") {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Redirigiendo al acceso…" /></main>;
  }
  if (!isAdmin) {
    return <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6"><ErrorState action={<Link className="font-bold underline" href="/">Volver al panel</Link>} message="Tu rol no puede consultar inventario." title="Acceso restringido" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-[90rem]">
        <header className="border-b border-slate-300 pb-6">
          <Link className="text-sm font-bold text-blue-800 hover:underline" href="/">← Panel principal</Link>
          <p className="mb-0 mt-5 text-xs font-bold uppercase tracking-[.18em] text-blue-800">Existencias · Administración</p>
          <h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Inventario</h1>
          <p className="mb-0 mt-2 text-slate-600">Consulta balances, disponibilidad y movimientos de cada producto.</p>
        </header>

        <BackofficeListLayout
          filters={(
            <form className="grid gap-4" key={`filters:${searchParams.toString()}`} onSubmit={(event) => { event.preventDefault(); applyFilters(new FormData(event.currentTarget)); }}>
              <label className="grid gap-1 text-sm font-semibold">Estado del producto<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.status ?? ""} name="status"><option value="">Todos</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Disponibilidad<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.availability ?? ""} name="availability"><option value="">Todas</option><option value="IN_STOCK">Con stock</option><option value="OUT_OF_STOCK">Agotadas</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Productos por página<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.pageSize} name="pageSize"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Ordenar por<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortBy} name="sortBy"><option value="updatedAt">Actualización</option><option value="name">Nombre</option><option value="sku">SKU</option><option value="status">Estado</option><option value="availableQuantity">Unidades disponibles</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Dirección<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortOrder} name="sortOrder"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label>
              <button className="min-h-11 rounded-lg bg-[#15345b] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" type="submit">Aplicar filtros</button>
              <button className="min-h-10 font-bold text-blue-800 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" onClick={() => { navigate({ page: 1, pageSize: 20, status: undefined, availability: undefined, sortBy: "updatedAt", sortOrder: "desc" }); setFiltersOpen(false); }} type="button">Restablecer filtros</button>
            </form>
          )}
          filtersOpen={filtersOpen}
          filtersTitle="Filtros de inventario"
          onFiltersOpenChange={setFiltersOpen}
          search={<BackofficeListSearch label="Buscar inventario" onClear={() => navigate({ page: 1, search: undefined })} onSearch={(search) => navigate({ page: 1, search: search || undefined })} placeholder="Nombre o SKU de producto" value={filters.search} />}
        >
          <section aria-labelledby="inventory-balance-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-bold" id="inventory-balance-title">Balances de inventario</h2>
              <p className="m-0 text-sm text-slate-600">{balancesQuery.data ? `${balancesQuery.data.totalItems} productos` : "Consultando balances"}</p>
            </div>
            {balancesQuery.isPending ? <LoadingState message="Cargando balances de inventario…" /> : balancesQuery.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => { void balancesQuery.refetch(); }} type="button">Reintentar</button>} message={balancesQuery.error instanceof InventoryApiError ? balancesQuery.error.message : "No pudimos cargar el inventario."} /> : <><DataTable caption="Balances administrativos de inventario" columns={columns} emptyMessage="No hay balances que coincidan con los criterios." rowKey={(balance) => balance.productId} rows={balancesQuery.data.items} />{balancesQuery.data.totalPages > 0 && filters.page <= balancesQuery.data.totalPages ? <div className="mt-5"><BackofficePagination page={balancesQuery.data.page} totalPages={balancesQuery.data.totalPages} /></div> : filters.page > 1 ? <button className="mt-5 font-bold text-blue-700 underline" onClick={() => navigate({ page: 1 })} type="button">Volver a la primera página</button> : null}</>}
          </section>
        </BackofficeListLayout>
      </div>
    </main>
  );
}
