"use client";

import { useState, type FormEvent } from "react";
import { HeroShowcase } from "./hero-showcase";

export function CatalogHero({
  initialSearchValue,
  onSearch,
}: Readonly<{
  initialSearchValue: string;
  onSearch: (search: string) => void;
}>) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSearch(data.get("search")?.toString().trim() ?? "");
  }

  return (
    <section data-slot="catalog-hero" className="storefront-hero" aria-labelledby="catalog-hero-title">
      <div className="hero-introduction">
        <div>
          <p className="mb-4 mt-0 text-xs font-bold uppercase tracking-[0.18em] text-[var(--ds-accent)]">Tecnología seleccionada</p>
          <h1 id="catalog-hero-title" className="m-0 max-w-3xl text-balance text-4xl font-semibold leading-[1.06] sm:text-5xl lg:text-6xl">
            El equipo correcto <span className="text-[var(--ds-accent)]">cambia tu ritmo.</span>
          </h1>
          <p className="mb-0 mt-5 max-w-xl text-lg leading-relaxed text-[var(--ds-text-muted)]">
            Notebooks, monitores y periféricos para trabajar, crear y jugar. Encuentra tu próximo equipo.
          </p>
        </div>
          <form className="hero-search" action="/products" method="get" onSubmit={handleSubmit} role="search"
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
            <input type="hidden" name="page" value="1" />
            <label className="mb-3 block text-sm font-semibold" htmlFor="catalog-search">Buscar en el catálogo</label>
            <input
              className="hero-search-input"
              defaultValue={initialSearchValue}
              id="catalog-search"
              name="search"
              placeholder="Producto, descripción o SKU"
              type="search"
            />
            <button className="hero-search-submit" type="submit">
              Buscar productos <span aria-hidden="true">→</span>
            </button>
          </form>
      </div>
      <HeroShowcase interacting={hovered || focused} />
    </section>
  );
}
