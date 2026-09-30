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
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm transition hover:border-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
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
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_20px_55px_-45px_rgba(15,23,42,0.55)]">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 border-t-2 border-t-blue-700 px-4 py-4">
            <div className="min-w-0">
              <p className="m-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Refina la selección</p>
              <h2 className="mb-0 mt-1 text-base font-black tracking-tight text-slate-950" id={titleId}>Filtros</h2>
            </div>
            <IconButton
              ariaControls={panelId}
              ariaExpanded={!collapsed}
              className="border-slate-300 bg-white text-slate-600 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700"
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
            className="border-slate-300 bg-white text-slate-600 shadow-sm hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700"
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
      <label className="grid gap-2 text-sm font-bold text-slate-800">
        Categoría
        {categories ? (
          <select
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15"
            defaultValue={query.categoryId ?? ""}
            name="categoryId"
          >
            <option value="">Todas las categorías</option>
            {query.categoryId && !categories.some((category) => category.id === query.categoryId) ? <option value={query.categoryId}>Categoría no disponible</option> : null}
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        ) : null}
      </label>
      {categoriesPending ? <p className="m-0 text-xs text-slate-600">Cargando categorías…</p> : null}
      {categoriesError ? (
        <div className="grid gap-2 text-xs text-red-700" role="alert">
          <p className="m-0">No se pudieron cargar las categorías.</p>
          <button className="min-h-9 justify-self-start rounded-lg border border-red-200 px-3 py-1.5 font-bold text-red-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700" onClick={onRetryCategories} type="button">Reintentar categorías</button>
        </div>
      ) : null}

      <fieldset className="grid gap-2 border-0 border-t border-slate-200 p-0 pt-4">
        <legend className="mb-1 px-0 text-sm font-bold text-slate-800">Etiquetas</legend>
        {tags?.map((tag) => (
          <label className="flex min-h-9 items-center gap-2 text-sm text-slate-700" key={tag.id}>
            <input className="size-4 accent-blue-700" defaultChecked={query.tagIds?.includes(tag.id)} name="tagIds" type="checkbox" value={tag.id} />
            {tag.name}
          </label>
        ))}
        {query.tagIds?.filter((id) => !tags?.some((tag) => tag.id === id)).map((id) => (
          <label className="flex min-h-9 items-center gap-2 text-sm text-slate-600" key={id}>
            <input className="size-4 accent-blue-700" defaultChecked name="tagIds" type="checkbox" value={id} />
            Etiqueta no disponible
          </label>
        ))}
        {tags?.length === 0 ? <p className="m-0 text-xs text-slate-600">No hay etiquetas activas.</p> : null}
        {tagsPending ? <p className="m-0 text-xs text-slate-600">Cargando etiquetas…</p> : null}
        {tagsError ? (
          <div className="grid gap-2 text-xs text-red-700" role="alert">
            <p className="m-0">No se pudieron cargar las etiquetas.</p>
            <button className="min-h-9 justify-self-start rounded-lg border border-red-200 px-3 py-1.5 font-bold text-red-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700" onClick={onRetryTags} type="button">Reintentar etiquetas</button>
          </div>
        ) : null}
      </fieldset>

      <label className="grid gap-2 border-t border-slate-200 pt-4 text-sm font-bold text-slate-800">
        Disponibilidad
        <select
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15"
          defaultValue={query.availability ?? ""}
          name="availability"
        >
          <option value="">Todos los productos</option>
          <option value="IN_STOCK">Con stock</option>
          <option value="OUT_OF_STOCK">Agotados</option>
        </select>
      </label>

      <fieldset className="grid grid-cols-2 gap-3 border-0 border-t border-slate-200 p-0 pt-4">
        <legend className="col-span-2 mb-1 px-0 text-sm font-bold text-slate-800">Rango de precio</legend>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Mínimo
          <input
            className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15"
            defaultValue={query.minPrice ?? ""}
            min="0"
            name="minPrice"
            placeholder="0"
            step="0.01"
            type="number"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600">
          Máximo
          <input
            className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15"
            defaultValue={query.maxPrice ?? ""}
            min="0"
            name="maxPrice"
            placeholder="Sin límite"
            step="0.01"
            type="number"
          />
        </label>
      </fieldset>

      <label className="grid gap-2 border-t border-slate-200 pt-4 text-sm font-bold text-slate-800">
        Ordenar por
        <select
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15"
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

      <div className="flex gap-2 border-t border-slate-200 pt-4">
        <button className="min-h-11 flex-1 rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canApply} type="submit">
          Aplicar
        </button>
        <button className="min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" onClick={onClear} type="button">
          Limpiar
        </button>
      </div>
    </form>
  );
}

function ActiveFilterBadge({ count }: Readonly<{ count: number }>) {
  if (count === 0) return null;

  return (
    <span aria-label={`${count} filtros activos`} className="grid min-h-6 min-w-6 place-items-center rounded-full bg-blue-700 px-1.5 text-xs font-black text-white">
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
