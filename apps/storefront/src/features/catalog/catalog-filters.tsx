"use client";

import { getActiveCategories, getActiveTags } from "@technology-ecommerce/api-client";
import { IconButton, FilterDrawer } from "@technology-ecommerce/ui";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";

import type { CatalogQuery } from "./catalog-query";

export type CatalogFilterValues = Pick<
  CatalogQuery,
  "availability" | "categoryId" | "tagIds" | "maxPrice" | "minPrice" | "sortBy" | "sortOrder"
>;

const sortOptions = [
  { label: "Más recientes", sortBy: "createdAt", sortOrder: "desc" },
  { label: "Precio: menor a mayor", sortBy: "price", sortOrder: "asc" },
  { label: "Precio: mayor a menor", sortBy: "price", sortOrder: "desc" },
  { label: "Nombre: A a Z", sortBy: "name", sortOrder: "asc" },
  { label: "Mayor disponibilidad", sortBy: "stockAvailable", sortOrder: "desc" },
] as const;

type CatalogFiltersProps = Readonly<{
  collapsed: boolean;
  onApply: (values: CatalogFilterValues) => void;
  onClear: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
  query: CatalogQuery;
}>;

type CatalogFilterFormProps = Readonly<{
  categories: Awaited<ReturnType<typeof getActiveCategories>> | undefined;
  categoriesError: boolean;
  categoriesPending: boolean;
  onApply: (values: CatalogFilterValues) => void;
  onApplied?: () => void;
  onClear: () => void;
  onRetryCategories: () => void;
  onRetryTags: () => void;
  query: CatalogQuery;
  tags: Awaited<ReturnType<typeof getActiveTags>> | undefined;
  tagsError: boolean;
  tagsPending: boolean;
}>;

export function CatalogFilters({
  collapsed,
  onApply,
  onClear,
  onCollapsedChange,
  query,
}: CatalogFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();
  const mobilePanelId = useId();
  const titleId = useId();
  const closeMobilePanel = useCallback(() => setMobileOpen(false), []);
  const hideFiltersRef = useRef<HTMLButtonElement>(null);
  const showFiltersRef = useRef<HTMLButtonElement>(null);
  const restoreToggleFocus = useRef(false);

  useEffect(() => {
    if (!restoreToggleFocus.current) return;
    restoreToggleFocus.current = false;
    (collapsed ? showFiltersRef : hideFiltersRef).current?.focus();
  }, [collapsed]);

  function toggleDesktopFilters(nextCollapsed: boolean) {
    restoreToggleFocus.current = true;
    onCollapsedChange(nextCollapsed);
  }

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(min-width: 1024px)");
    function closeOnDesktop() {
      if (media.matches) setMobileOpen(false);
    }
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  const classificationsEnabled = !collapsed || mobileOpen;
  const categoriesQuery = useQuery({
    enabled: classificationsEnabled,
    queryKey: ["classifications", "active-categories"],
    queryFn: ({ signal }) => getActiveCategories(signal),
  });
  const tagsQuery = useQuery({
    enabled: classificationsEnabled,
    queryKey: ["classifications", "active-tags"],
    queryFn: ({ signal }) => getActiveTags(signal),
  });

  const activeFilterCount = [
    query.categoryId,
    query.tagIds?.length ? "tags" : undefined,
    query.availability,
    query.minPrice,
    query.maxPrice,
    query.sortBy !== "createdAt" || query.sortOrder !== "desc" ? "sort" : undefined,
  ].filter(Boolean).length;

  const filterFormProps: CatalogFilterFormProps = {
    categories: categoriesQuery.data,
    categoriesError: categoriesQuery.isError,
    categoriesPending: categoriesQuery.isPending,
    onApply,
    onClear,
    onRetryCategories: () => void categoriesQuery.refetch(),
    onRetryTags: () => void tagsQuery.refetch(),
    query,
    tags: tagsQuery.data,
    tagsError: tagsQuery.isError,
    tagsPending: tagsQuery.isPending,
  };

  function clearMobileFilters() {
    onClear();
    closeMobilePanel();
  }

  return (
    <>
      <div className="lg:hidden">
        <button
          aria-controls={mobilePanelId}
          aria-expanded={mobileOpen}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2 text-sm font-black text-[var(--ds-text)] shadow-sm transition hover:border-[var(--ds-accent)] hover:text-[var(--ds-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <FilterGlyph />
          Filtros
          <ActiveFilterBadge count={activeFilterCount} />
        </button>
      </div>

      <aside
        aria-hidden={collapsed}
        aria-labelledby={titleId}
        className={collapsed ? "hidden" : "hidden lg:block"}
        data-state={collapsed ? "collapsed" : "expanded"}
        id={panelId}
        inert={collapsed}
      >
        <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] shadow-[var(--ds-elevation)]">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--ds-border)] border-t-2 border-t-[var(--ds-accent)] px-4 py-4">
            <div className="min-w-0">
              <p className="m-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ds-accent)]">Refina la selección</p>
              <h2 className="mb-0 mt-1 text-base font-black tracking-tight text-[var(--ds-text)]" id={titleId}>Filtros</h2>
            </div>
            <IconButton
              ariaControls={panelId}
              ariaExpanded={!collapsed}
              className="border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)] hover:border-[var(--ds-accent)] hover:bg-[var(--ds-accent-soft)] hover:text-[var(--ds-accent)]"
              icon="chevron-left"
              label="Ocultar filtros del catálogo"
              onClick={() => toggleDesktopFilters(true)}
              ref={hideFiltersRef}
            />
          </header>
          <div className="p-4">
            <CatalogFilterForm {...filterFormProps} />
          </div>
        </div>
      </aside>

      {collapsed ? (
        <div className="hidden lg:block">
          <IconButton
            ariaControls={panelId}
            ariaExpanded={false}
            className="border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text-muted)] shadow-sm hover:border-[var(--ds-accent)] hover:bg-[var(--ds-accent-soft)] hover:text-[var(--ds-accent)]"
            icon="chevron-right"
            label="Mostrar filtros del catálogo"
            onClick={() => toggleDesktopFilters(false)}
            ref={showFiltersRef}
          />
        </div>
      ) : null}

      <FilterDrawer
        id={mobilePanelId}
        onClose={closeMobilePanel}
        open={mobileOpen}
        title="Filtros del catálogo"
      >
        <CatalogFilterForm
          {...filterFormProps}
          onApplied={closeMobilePanel}
          onClear={clearMobileFilters}
          onApply={onApply}
        />
      </FilterDrawer>
    </>
  );
}

function CatalogFilterForm({
  categories,
  categoriesError,
  categoriesPending,
  onApply,
  onApplied,
  onClear,
  onRetryCategories,
  onRetryTags,
  query,
  tags,
  tagsError,
  tagsPending,
}: CatalogFilterFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const minPrice = data.get("minPrice")?.toString().trim() || undefined;
    const maxPrice = data.get("maxPrice")?.toString().trim() || undefined;
    const maxPriceInput = event.currentTarget.elements.namedItem("maxPrice");

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      Number(minPrice) > Number(maxPrice) &&
      maxPriceInput instanceof HTMLInputElement
    ) {
      maxPriceInput.setCustomValidity("El precio máximo debe ser igual o mayor al mínimo.");
      maxPriceInput.reportValidity();
      return;
    }

    if (maxPriceInput instanceof HTMLInputElement) maxPriceInput.setCustomValidity("");

    const sortValue = data.get("sort")?.toString();
    const sort = sortOptions.find(
      (option) => `${option.sortBy}:${option.sortOrder}` === sortValue,
    ) ?? sortOptions[0];
    const availabilityValue = data.get("availability")?.toString();

    onApply({
      availability:
        availabilityValue === "IN_STOCK" || availabilityValue === "OUT_OF_STOCK"
          ? availabilityValue
          : undefined,
      categoryId: data.get("categoryId")?.toString() || undefined,
      tagIds: data.getAll("tagIds").map(String).slice(0, 20),
      maxPrice,
      minPrice,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    });
    onApplied?.();
  }

  const canApply = Boolean(categories && tags) && !categoriesPending && !tagsPending;

  return (
    <form aria-label="Filtros del catálogo" className="grid gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-bold text-[var(--ds-text)]">
        Categoría
        {categories ? (
          <select
            className="min-h-11 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 text-sm font-medium text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] focus:ring-4 focus:ring-[var(--ds-accent-soft)]"
            defaultValue={query.categoryId ?? ""}
            name="categoryId"
          >
            <option value="">Todas las categorías</option>
            {query.categoryId && !categories.some((category) => category.id === query.categoryId) ? <option value={query.categoryId}>Categoría no disponible</option> : null}
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        ) : null}
      </label>
      {categoriesPending ? <p className="m-0 text-xs text-[var(--ds-text-muted)]">Cargando categorías…</p> : null}
      {categoriesError ? (
        <div className="grid gap-2 text-xs text-[var(--ds-danger)]" role="alert">
          <p className="m-0">No se pudieron cargar las categorías.</p>
          <button className="min-h-9 justify-self-start rounded-lg border border-[var(--ds-danger)] px-3 py-1.5 font-bold text-[var(--ds-danger)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)]" onClick={onRetryCategories} type="button">Reintentar categorías</button>
        </div>
      ) : null}

      <fieldset className="grid gap-2 border-0 border-t border-[var(--ds-border)] p-0 pt-4">
        <legend className="mb-1 px-0 text-sm font-bold text-[var(--ds-text)]">Etiquetas</legend>
        {tags?.map((tag) => (
          <label className="flex min-h-9 items-center gap-2 text-sm text-[var(--ds-text-muted)]" key={tag.id}>
            <input className="size-4 accent-[var(--ds-accent)]" defaultChecked={query.tagIds?.includes(tag.id)} name="tagIds" type="checkbox" value={tag.id} />
            {tag.name}
          </label>
        ))}
        {query.tagIds?.filter((id) => !tags?.some((tag) => tag.id === id)).map((id) => (
          <label className="flex min-h-9 items-center gap-2 text-sm text-[var(--ds-text-muted)]" key={id}>
            <input className="size-4 accent-[var(--ds-accent)]" defaultChecked name="tagIds" type="checkbox" value={id} />
            Etiqueta no disponible
          </label>
        ))}
        {tags?.length === 0 ? <p className="m-0 text-xs text-[var(--ds-text-muted)]">No hay etiquetas activas.</p> : null}
        {tagsPending ? <p className="m-0 text-xs text-[var(--ds-text-muted)]">Cargando etiquetas…</p> : null}
        {tagsError ? (
          <div className="grid gap-2 text-xs text-[var(--ds-danger)]" role="alert">
            <p className="m-0">No se pudieron cargar las etiquetas.</p>
            <button className="min-h-9 justify-self-start rounded-lg border border-[var(--ds-danger)] px-3 py-1.5 font-bold text-[var(--ds-danger)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)]" onClick={onRetryTags} type="button">Reintentar etiquetas</button>
          </div>
        ) : null}
      </fieldset>

      <label className="grid gap-2 border-t border-[var(--ds-border)] pt-4 text-sm font-bold text-[var(--ds-text)]">
        Disponibilidad
        <select
          className="min-h-11 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 text-sm font-medium text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] focus:ring-4 focus:ring-[var(--ds-accent-soft)]"
          defaultValue={query.availability ?? ""}
          name="availability"
        >
          <option value="">Todos los productos</option>
          <option value="IN_STOCK">Con stock</option>
          <option value="OUT_OF_STOCK">Agotados</option>
        </select>
      </label>

      <fieldset className="grid grid-cols-2 gap-3 border-0 border-t border-[var(--ds-border)] p-0 pt-4">
        <legend className="col-span-2 mb-1 px-0 text-sm font-bold text-[var(--ds-text)]">Rango de precio</legend>
        <label className="grid gap-1 text-xs font-semibold text-[var(--ds-text-muted)]">
          Mínimo
          <input
            className="min-h-11 min-w-0 rounded-xl bg-[var(--ds-surface)] border border-[var(--ds-border)] px-3 text-sm text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] focus:ring-4 focus:ring-[var(--ds-accent-soft)]"
            defaultValue={query.minPrice ?? ""}
            min="0"
            name="minPrice"
            placeholder="0"
            step="0.01"
            type="number"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[var(--ds-text-muted)]">
          Máximo
          <input
            className="min-h-11 min-w-0 rounded-xl bg-[var(--ds-surface)] border border-[var(--ds-border)] px-3 text-sm text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] focus:ring-4 focus:ring-[var(--ds-accent-soft)]"
            defaultValue={query.maxPrice ?? ""}
            min="0"
            name="maxPrice"
            placeholder="Sin límite"
            step="0.01"
            type="number"
          />
        </label>
      </fieldset>

      <label className="grid gap-2 border-t border-[var(--ds-border)] pt-4 text-sm font-bold text-[var(--ds-text)]">
        Ordenar por
        <select
          className="min-h-11 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 text-sm font-medium text-[var(--ds-text)] outline-none focus:border-[var(--ds-accent)] focus:ring-4 focus:ring-[var(--ds-accent-soft)]"
          defaultValue={`${query.sortBy}:${query.sortOrder}`}
          name="sort"
        >
          {sortOptions.map((option) => (
            <option key={`${option.sortBy}:${option.sortOrder}`} value={`${option.sortBy}:${option.sortOrder}`}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 border-t border-[var(--ds-border)] pt-4">
        <button className="min-h-11 flex-1 rounded-xl bg-[var(--ds-accent)] px-4 py-2 text-sm font-black text-[var(--ds-accent-text)] transition hover:bg-[var(--ds-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canApply} type="submit">
          Aplicar
        </button>
        <button className="min-h-11 rounded-xl border border-[var(--ds-border)] px-3 py-2 text-sm font-bold text-[var(--ds-text-muted)] transition hover:border-[var(--ds-border)] hover:bg-[var(--ds-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2" onClick={onClear} type="button">
          Limpiar
        </button>
      </div>
    </form>
  );
}

function ActiveFilterBadge({ count }: Readonly<{ count: number }>) {
  if (count === 0) return null;

  return (
    <span aria-label={`${count} filtros activos`} className="grid min-h-6 min-w-6 place-items-center rounded-full bg-[var(--ds-accent)] px-1.5 text-xs font-black text-[var(--ds-accent-text)]">
      {count}
    </span>
  );
}

function FilterGlyph() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" fill="white" r="2" />
      <circle cx="15" cy="17" fill="white" r="2" />
    </svg>
  );
}
