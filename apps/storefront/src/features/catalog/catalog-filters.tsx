import type { FormEvent } from "react";

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
  }

  return (
    <form
      className="mb-9 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_45px_-36px_rgba(15,23,42,0.5)] md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.35fr_auto] lg:items-end"
      onSubmit={handleSubmit}
    >
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

      <div className="flex gap-2 md:col-span-2 lg:col-span-1">
        <button className="min-h-11 flex-1 rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" type="submit">
          Aplicar
        </button>
        <button className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" onClick={onClear} type="button">
          Limpiar
        </button>
      </div>
    </form>
  );
}
