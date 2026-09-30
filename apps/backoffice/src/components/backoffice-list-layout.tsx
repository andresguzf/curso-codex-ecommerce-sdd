"use client";

import { CollapsibleSidePanel, FilterDrawer, Icon } from "@technology-ecommerce/ui";
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

export function BackofficeListSearch({
  label,
  onClear,
  onSearch,
  placeholder,
  value,
}: Readonly<{
  label: string;
  onClear?: () => void;
  onSearch: (term: string) => void;
  placeholder: string;
  value?: string;
}>) {
  const inputId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = String(new FormData(event.currentTarget).get("search") ?? "").trim();
    onSearch(term);
  }

  return (
    <form
      aria-label={label}
      className="flex min-w-0 flex-1 flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-nowrap sm:p-4"
      key={`search:${value ?? ""}`}
      onSubmit={submit}
      role="search"
    >
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <input
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-sm outline-none transition placeholder:text-slate-500 focus:border-blue-700 focus:ring-2 focus:ring-blue-200"
        defaultValue={value}
        id={inputId}
        maxLength={200}
        name="search"
        placeholder={placeholder}
        type="search"
      />
      <button
        className="min-h-11 rounded-lg bg-[#15345b] px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
        type="submit"
      >
        Buscar
      </button>
      {value && onClear ? (
        <button
          className="min-h-11 rounded-lg px-3 py-2 text-sm font-bold text-blue-800 underline-offset-2 transition hover:bg-blue-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          onClick={onClear}
          type="button"
        >
          Limpiar
        </button>
      ) : null}
    </form>
  );
}

export function BackofficeListLayout({
  children,
  filters,
  filtersOpen,
  filtersTitle,
  onFiltersOpenChange,
  search,
}: Readonly<{
  children: ReactNode;
  filters: ReactNode;
  filtersOpen: boolean;
  filtersTitle: string;
  onFiltersOpenChange: (open: boolean) => void;
  search: ReactNode;
}>) {
  const desktopPanelId = useId();
  const mobilePanelId = useId();
  const [isCompact, setIsCompact] = useState(false);
  const closeFilters = useCallback(() => onFiltersOpenChange(false), [onFiltersOpenChange]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => setIsCompact(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);

    return () => media.removeEventListener("change", updateViewport);
  }, []);

  return (
    <div
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-2"
      data-slot="backoffice-list-layout"
    >
      <div className="min-w-0 lg:col-span-3">{search}</div>

      <button
        aria-controls={isCompact ? mobilePanelId : desktopPanelId}
        aria-expanded={filtersOpen}
        aria-label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
        className="col-start-2 row-start-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-600 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 lg:row-start-2 lg:size-10 lg:min-h-10 lg:px-0"
        onClick={() => onFiltersOpenChange(!filtersOpen)}
        title={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
        type="button"
      >
        <span className="lg:hidden">Filtros</span>
        <span aria-hidden="true" className="hidden lg:inline-flex">
          <Icon name={filtersOpen ? "chevron-left" : "chevron-right"} />
        </span>
      </button>

      <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-1 lg:row-start-2">
        {children}
      </div>

      {!isCompact ? (
        <div className="hidden lg:col-start-3 lg:row-start-2 lg:block">
          <CollapsibleSidePanel
            id={desktopPanelId}
            onClose={closeFilters}
            open={filtersOpen}
            title={filtersTitle}
          >
            {filters}
          </CollapsibleSidePanel>
        </div>
      ) : null}

      {isCompact ? (
        <div className="lg:hidden">
        <FilterDrawer
          id={mobilePanelId}
          onClose={closeFilters}
          open={filtersOpen}
          side="right"
          title={filtersTitle}
        >
          {filters}
        </FilterDrawer>
        </div>
      ) : null}
    </div>
  );
}
