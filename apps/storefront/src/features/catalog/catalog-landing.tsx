"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@technology-ecommerce/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { getPublicProducts } from "./catalog-api";
import { CatalogFilters, type CatalogFilterValues } from "./catalog-filters";
import { CatalogHero } from "./catalog-hero";
import { parseCatalogQuery } from "./catalog-query";
import { ProductGrid } from "./product-grid";

export function CatalogLanding() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = parseCatalogQuery(searchParams);
  const productsQuery = useQuery({
    queryFn: () => getPublicProducts(query),
    queryKey: ["catalog", "public", query],
  });

  function navigateWith(updates: Record<string, string | undefined>) {
    const nextParams = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([name, value]) => {
      if (value === undefined || value === "") {
        nextParams.delete(name);
      } else {
        nextParams.set(name, value);
      }
    });
    nextParams.set("page", "1");

    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  function handleApplyFilters(values: CatalogFilterValues) {
    navigateWith({
      availability: values.availability,
      maxPrice: values.maxPrice,
      minPrice: values.minPrice,
      sortBy: values.sortBy,
      sortOrder: values.sortOrder,
    });
  }

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <CatalogHero
        initialSearchValue={query.search ?? ""}
        key={`hero-search:${query.search ?? ""}`}
        onSearch={(search) => navigateWith({ search: search || undefined })}
      />
      <section aria-labelledby="catalog-title" className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20">
        <div className="mb-9 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Catálogo activo</p>
            <h2 className="mb-0 mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl" id="catalog-title">
              Equipos listos para elegir
            </h2>
          </div>
          {productsQuery.data ? (
            <p className="m-0 text-sm font-semibold text-slate-600">
              {productsQuery.data.totalItems} productos encontrados
            </p>
          ) : null}
        </div>

        <CatalogFilters
          key={`filters:${query.availability ?? "all"}:${query.minPrice ?? ""}:${query.maxPrice ?? ""}:${query.sortBy}:${query.sortOrder}`}
          onApply={handleApplyFilters}
          onClear={() => navigateWith({
            availability: undefined,
            maxPrice: undefined,
            minPrice: undefined,
            sortBy: undefined,
            sortOrder: undefined,
          })}
          query={query}
        />

        {productsQuery.isPending ? <LoadingState message="Cargando productos disponibles…" /> : null}
        {productsQuery.isError ? (
          <ErrorState
            action={(
              <button className="min-h-11 rounded-lg bg-red-800 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2" onClick={() => void productsQuery.refetch()} type="button">
                Intentar nuevamente
              </button>
            )}
            message="Comprueba que la API esté disponible y vuelve a intentarlo."
          />
        ) : null}
        {productsQuery.data ? <ProductGrid products={productsQuery.data.items} /> : null}
      </section>
    </main>
  );
}
