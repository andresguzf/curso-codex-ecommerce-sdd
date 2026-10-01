"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAddToCart } from "../cart/use-add-to-cart";
import { getCatalogLanding } from "./catalog-api";
import { CatalogHero } from "./catalog-hero";
import { ProductGrid } from "./product-grid";
import { LandingProductSection } from "./landing-product-section";

export function CatalogLanding() {
  const router = useRouter();
  const productsQuery = useQuery({
    queryFn: ({ signal }) => getCatalogLanding(signal),
    queryKey: ["catalog", "public", "landing"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const { addProduct, isAdding } = useAddToCart();

  function handleHeroSearch(search: string) {
    const params = new URLSearchParams({ page: "1" });
    if (search) params.set("search", search);
    router.push(`/products?${params.toString()}`, { scroll: true });
  }

  return (
    <main className="min-h-screen bg-[var(--ds-canvas)]">
      <CatalogHero initialSearchValue="" onSearch={handleHeroSearch} />
      {productsQuery.data && !productsQuery.isError ? <LandingProductSection
        id="featured" title="Productos destacados" eyebrow="Selección de la tienda"
        description="Equipos seleccionados para descubrir antes de explorar el catálogo."
        featured products={productsQuery.data.featuredProducts} isAdding={isAdding}
        onAddToCart={(product) => void addProduct(product)}
      /> : null}
      <section aria-labelledby="catalog-title" className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20" id="catalog" data-slot="landing-latest">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--ds-accent)]">Novedades del catálogo</p>
            <h2 className="mb-0 mt-2 text-3xl font-black tracking-tight text-[var(--ds-text)] sm:text-4xl" id="catalog-title">
              Lo último en tecnología
            </h2>
            <p className="mb-0 mt-3 text-sm text-[var(--ds-text-muted)]">Los equipos que acaban de llegar a la tienda.</p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-3 rounded-xl bg-[var(--ds-accent)] px-5 py-2 text-sm font-black text-[var(--ds-accent-text)] transition hover:bg-[var(--ds-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2"
            href="/products"
          >
            Ver todos los productos
            <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="min-w-0" id="catalog-results" aria-busy={productsQuery.isPending}>
          {productsQuery.isPending ? <LoadingState message="Cargando novedades…" /> : null}
          {productsQuery.isError ? (
            <ErrorState
              action={(
                <button className="min-h-11 rounded-lg bg-[var(--ds-accent)] px-4 py-2 text-sm font-bold text-[var(--ds-accent-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" onClick={() => void productsQuery.refetch()} type="button">
                  Intentar nuevamente
                </button>
              )}
              message="No pudimos cargar las novedades. Inténtalo nuevamente o explora todos los productos."
            />
          ) : null}
          {productsQuery.data && !productsQuery.isError ? (
            productsQuery.data.latestProducts.length ? (
              <ProductGrid
                isAdding={isAdding}
                onAddToCart={(product) => void addProduct(product)}
                products={productsQuery.data.latestProducts}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--ds-border)] bg-[var(--ds-surface)] px-6 py-14 text-center">
                <h3 className="m-0 text-xl font-black text-[var(--ds-text)]">Todavía no hay novedades</h3>
                <p className="mb-0 mt-2 text-sm text-[var(--ds-text-muted)]">Puedes explorar el catálogo completo desde “Ver todos los productos”.</p>
              </div>
            )
          ) : null}
        </div>
      </section>
      {productsQuery.data && !productsQuery.isError ? productsQuery.data.highlightedCategories.map(({ category, products }) => (
        <LandingProductSection key={category.id} id={`landing-category-${category.id}`} title={category.name}
          eyebrow="Explora por categoría" description={`Lo más reciente en ${category.name}.`}
          categoryId={category.id} products={products} isAdding={isAdding}
          onAddToCart={(product) => void addProduct(product)} />
      )) : null}
    </main>
  );
}
