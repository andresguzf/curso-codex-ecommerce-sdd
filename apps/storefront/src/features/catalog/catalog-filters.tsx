"use client";

import { FilterDrawer } from "@technology-ecommerce/ui";
import { useState, type FormEvent } from "react";

import type { CatalogQuery } from "./catalog-query";

export type CatalogFilterValues = Pick<
  CatalogQuery,
  "availability" | "maxPrice" | "minPrice" | "sortBy" | "sortOrder"
>;

const sortOptions = [
  { label: "Más recientes", sortBy: "createdAt", sortOrder: "desc" },
  { label: "Precio: menor a mayor", sortBy: "price", sortOrder: "asc" },
  { label: "Precio: mayor a menor", sortBy: "price", sortOrder: "desc" },
  { label: "Nombre: A a Z", sortBy: "name", sortOrder: "asc" },
  { label: "Mayor disponibilidad", sortBy: "stockAvailable", sortOrder: "desc" },
] as const;

export function CatalogFilters({
  onApply,
  onClear,
  query,
}: Readonly<{
  onApply: (values: CatalogFilterValues) => void;
  onClear: () => void;
  query: CatalogQuery;
}>) {
  const [open, setOpen] = useState(false);

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

    if (maxPriceInput instanceof HTMLInputElement) {
      maxPriceInput.setCustomValidity("");
    }

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
      maxPrice,
      minPrice,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    });
    setOpen(false);
  }

  function handleClear() {
    onClear();
    setOpen(false);
  }

  const activeFilterCount = [
    query.availability,
    query.minPrice,
    query.maxPrice,
    query.sortBy !== "createdAt" || query.sortOrder !== "desc" ? "sort" : undefined,
  ].filter(Boolean).length;

  return (
    <>
      <div className="mb-9 flex flex-wrap items-center gap-3">
        <button
          aria-expanded={open}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-[0_16px_45px_-36px_rgba(15,23,42,0.5)] transition hover:border-blue-500 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          onClick={() => setOpen(true)}
          type="button"
        >
          <span aria-hidden="true">☰</span>
          Filtros
          {activeFilterCount > 0 ? (
            <span
              aria-label={`${activeFilterCount} filtros activos`}
              className="grid min-h-6 min-w-6 place-items-center rounded-full bg-blue-700 px-1.5 text-xs font-black text-white"
            >
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        <p className="m-0 text-sm font-semibold text-slate-600">
          Ajusta disponibilidad, precio y orden desde el panel lateral.
        </p>
      </div>

      <FilterDrawer onClose={() => setOpen(false)} open={open} title="Filtros del catálogo">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-bold text-slate-800">
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

          <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
            <legend className="col-span-2 mb-2 text-sm font-bold text-slate-800">Rango de precio</legend>
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

          <label className="grid gap-2 text-sm font-bold text-slate-800">
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

          <div className="flex gap-2">
            <button className="min-h-11 flex-1 rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" type="submit">
              Aplicar
            </button>
            <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" onClick={handleClear} type="button">
              Limpiar
            </button>
          </div>
        </form>
      </FilterDrawer>
    </>
  );
}
