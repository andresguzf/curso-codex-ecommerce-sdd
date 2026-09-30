"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useAddToCart } from "../cart/use-add-to-cart";
import { getPublicProducts } from "./catalog-api";
import { CatalogFilters, type CatalogFilterValues } from "./catalog-filters";
import { CatalogHero } from "./catalog-hero";
import { CATALOG_LANDING_PAGE_SIZE, parseCatalogQuery } from "./catalog-query";
import { ProductGrid } from "./product-grid";

export function CatalogLanding() {
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = parseCatalogQuery(searchParams);
  const productsQuery = useQuery({
    queryFn: () => getPublicProducts(query, CATALOG_LANDING_PAGE_SIZE),
    queryKey: ["catalog", "public", "landing", query],
  });
  const { addProduct, isAdding } = useAddToCart();

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
      categoryId: values.categoryId,
      tagIds: values.tagIds?.join(","),
      maxPrice: values.maxPrice,
      minPrice: values.minPrice,
      sortBy: values.sortBy,
      sortOrder: values.sortOrder,
    });
  }

  function handleHeroSearch(search: string) {
    const params = new URLSearchParams({ page: "1" });
    if (search) params.set("search", search);
    router.push(`/products?${params.toString()}`, { scroll: true });
  }

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <CatalogHero
        initialSearchValue={query.search ?? ""}
        key={`hero-search:${query.search ?? ""}`}
        onSearch={handleHeroSearch}
      />
      <section aria-labelledby="catalog-title" className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20" id="catalog">
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
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#15345b] px-5 py-2 text-sm font-black text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            href="/products"
          >
            Ver todos los productos
          </Link>
        </div>

        <div
          className={filtersCollapsed
            ? "grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8"
            : "grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[18rem_minmax(0,1fr)]"}
          data-filters-collapsed={filtersCollapsed}
        >
          <CatalogFilters
            collapsed={filtersCollapsed}
            key={`filters:${query.categoryId ?? "all"}:${query.tagIds?.join(",") ?? ""}:${query.availability ?? "all"}:${query.minPrice ?? ""}:${query.maxPrice ?? ""}:${query.sortBy}:${query.sortOrder}`}
            onApply={handleApplyFilters}
            onClear={() => navigateWith({
              availability: undefined,
              categoryId: undefined,
              tagIds: undefined,
              maxPrice: undefined,
              minPrice: undefined,
              sortBy: undefined,
              sortOrder: undefined,
            })}
            onCollapsedChange={setFiltersCollapsed}
            query={query}
          />

          <div className="min-w-0" id="catalog-results">
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
            {productsQuery.data ? (
              <ProductGrid
                isAdding={isAdding}
                onAddToCart={(product) => void addProduct(product)}
                products={productsQuery.data.items}
              />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
