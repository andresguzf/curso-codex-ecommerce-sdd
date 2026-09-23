import type { FormEvent } from "react";
import Image from "next/image";

export function CatalogHero({
  initialSearchValue,
  onSearch,
}: Readonly<{
  initialSearchValue: string;
  onSearch: (search: string) => void;
}>) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSearch(data.get("search")?.toString().trim() ?? "");
  }

  return (
    <section className="relative isolate overflow-hidden bg-[#081426] text-white" aria-labelledby="catalog-hero-title">
      <Image
        alt=""
        aria-hidden="true"
        className="object-cover object-[64%_center] opacity-80 lg:opacity-90"
        fill
        preload
        sizes="100vw"
        src="/images/hero-gaming-keyboard.png"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,20,38,0.96),rgba(8,20,38,0.82))] lg:bg-[linear-gradient(90deg,rgba(8,20,38,0.98)_0%,rgba(8,20,38,0.9)_38%,rgba(8,20,38,0.18)_100%)]" />
      <div className="relative mx-auto flex min-h-[30rem] max-w-7xl items-center px-6 py-16 sm:min-h-[34rem] lg:min-h-[36rem] lg:px-10 lg:py-24">
        <div className="w-full max-w-3xl">
          <p className="mb-5 flex items-center gap-3 text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            <span aria-hidden="true" className="h-px w-10 bg-cyan-300" />
            Tecnología seleccionada
          </p>
          <h1 id="catalog-hero-title" className="m-0 max-w-3xl text-balance text-5xl font-black leading-[0.96] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            El equipo correcto cambia tu ritmo.
          </h1>
          <p className="mb-0 mt-7 max-w-2xl text-lg leading-8 text-slate-200">
            Descubre notebooks, monitores y periféricos elegidos para trabajar,
            crear y jugar sin perder tiempo entre especificaciones vacías.
          </p>
          <form className="mt-9 flex max-w-2xl flex-col gap-3 sm:flex-row" onSubmit={handleSubmit} role="search">
            <label className="sr-only" htmlFor="catalog-search">Buscar en el catálogo</label>
            <input
              className="min-h-12 flex-1 rounded-xl border border-white/20 bg-white px-4 text-base text-slate-950 shadow-lg outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/20"
              defaultValue={initialSearchValue}
              id="catalog-search"
              name="search"
              placeholder="Busca por producto, descripción o SKU"
              type="search"
            />
            <button className="min-h-12 rounded-xl bg-cyan-300 px-6 font-black text-[#081426] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#081426]" type="submit">
              Buscar productos
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
