"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState, Pagination } from "@technology-ecommerce/ui";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAddToCart } from "../cart/use-add-to-cart";
import { getPublicProducts } from "./catalog-api";
import { CatalogFilters, type CatalogFilterValues } from "./catalog-filters";
import {
  CATALOG_PAGE_SIZE,
  parseCatalogQuery,
} from "./catalog-query";
import { ProductGrid } from "./product-grid";

export function CatalogPage() {
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = parseCatalogQuery(searchParams, CATALOG_PAGE_SIZE);
  const productsQuery = useQuery({
    queryFn: () => getPublicProducts(query, CATALOG_PAGE_SIZE),
    queryKey: ["catalog", "public", "complete", query],
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

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = String(formData.get("search") ?? "").trim();
    navigateWith({ search: search || undefined });
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

  function navigateToPage(page: number) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("page", String(page));
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  const pageData = productsQuery.data;
  const requestedPageIsOutOfRange = Boolean(
    pageData && (query.page > pageData.totalPages || pageData.totalPages === 0 && query.page > 1),
  );

  return (
    <main data-slot="catalog-page" className="min-h-screen bg-[var(--ds-canvas)]">
      <section className="mx-auto max-w-7xl px-6 py-9 lg:px-10 lg:py-14">
        <nav aria-label="Migas de pan" className="mb-6 text-sm font-semibold text-[var(--ds-text-muted)]">
          <Link className="rounded-sm text-[var(--ds-accent)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)]" href="/">
            Inicio
          </Link>
          <span aria-hidden="true" className="px-2 text-slate-400">/</span>
          <span aria-current="page" className="text-[var(--ds-text)]">Productos</span>
        </nav>

        <header className="mb-10 border-b border-[var(--ds-border-subtle)] pb-9">
          <div>
            <p className="m-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--ds-accent)]">
              Catálogo completo
            </p>
            <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)] lg:items-end">
              <div>
                <h1 className="m-0 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] text-[var(--ds-text)] sm:text-4xl">
                  Encuentra el equipo que va contigo.
                </h1>
                <p className="mb-0 mt-3 max-w-2xl text-sm leading-6 text-[var(--ds-text-muted)] sm:text-base">
                  Tecnología para trabajar, crear y jugar. Encuentra tu próximo equipo.
                </p>
              </div>
              <form
                aria-label="Buscar productos"
                className="flex flex-col gap-2 sm:flex-row"
                key={`catalog-search:${query.search ?? ""}`}
                onSubmit={handleSearch}
                role="search"
              >
                <label className="sr-only" htmlFor="complete-catalog-search">Buscar en todos los productos</label>
                <input
                  className="min-h-12 min-w-0 flex-1 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 text-sm text-[var(--ds-text)] outline-none placeholder:text-[var(--ds-text-muted)] focus:border-[var(--ds-focus)] focus:ring-2 focus:ring-[var(--ds-focus)]"
                  defaultValue={query.search ?? ""}
                  id="complete-catalog-search"
                  maxLength={200}
                  name="search"
                  placeholder="Nombre, descripción o SKU"
                  type="search"
                />
                <button className="min-h-12 rounded-xl bg-[var(--ds-accent)] px-5 py-2 text-sm font-black text-[var(--ds-accent-text)] transition hover:bg-[var(--ds-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" type="submit">
                  Buscar
                </button>
              </form>
            </div>
          </div>
        </header>

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

          <section aria-label="Resultados del catálogo" className="min-w-0">
            <div className="mb-5 flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-[var(--ds-border-subtle)] pb-4">
              <p aria-live="polite" className="m-0 text-sm font-bold text-[var(--ds-text-muted)]" role="status">
                {pageData ? `${pageData.totalItems} productos encontrados` : "Consultando productos"}
              </p>
              {pageData && pageData.totalPages > 0 && !requestedPageIsOutOfRange ? (
                <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--ds-text-muted)]">
                  Página {pageData.page} de {pageData.totalPages}
                </p>
              ) : null}
            </div>

            {productsQuery.isPending ? <LoadingState message="Cargando productos…" /> : null}
            {productsQuery.isError ? (
              <ErrorState
                action={(
                  <button className="min-h-11 rounded-lg bg-[var(--ds-accent)] px-4 py-2 text-sm font-bold text-[var(--ds-accent-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" onClick={() => void productsQuery.refetch()} type="button">
                    Intentar nuevamente
                  </button>
                )}
                message="No pudimos cargar el catálogo. Comprueba la conexión e inténtalo nuevamente."
              />
            ) : null}
            {pageData ? (
              <>
                <ProductGrid
                  isAdding={isAdding}
                  onAddToCart={(product) => void addProduct(product)}
                  products={pageData.items}
                />
                {pageData.totalPages > 0 && !requestedPageIsOutOfRange ? (
                  <div className="mt-8">
                    <Pagination
                      ariaLabel="Paginación del catálogo"
                      className="rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface)] px-3 py-5 sm:px-4"
                      onPageChange={navigateToPage}
                      page={pageData.page}
                      totalPages={pageData.totalPages}
                    />
                  </div>
                ) : requestedPageIsOutOfRange ? (
                  <div className="mt-6 text-center">
                    <button className="min-h-11 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-5 py-2 text-sm font-bold text-[var(--ds-accent)] underline-offset-4 hover:bg-[var(--ds-accent-soft)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" onClick={() => navigateToPage(1)} type="button">
                      Volver a la primera página
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
