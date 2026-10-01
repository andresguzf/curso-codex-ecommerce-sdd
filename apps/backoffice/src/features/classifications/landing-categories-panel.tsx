"use client";

import type { Category } from "@technology-ecommerce/api-schemas";
import { ErrorState, Icon, IconButton, LoadingState } from "@technology-ecommerce/ui";
import { useState } from "react";

export function LandingCategoriesPanel({ categories, error, isLoading, isPending, ready, onRetry, onSwap, onWithdraw }: Readonly<{
  categories: readonly Category[];
  error: boolean;
  isLoading: boolean;
  isPending: boolean;
  ready: boolean;
  onRetry: () => void;
  onSwap: (sourceId: string, targetId: string) => void;
  onWithdraw: (category: Category) => void;
}>) {
  const [draggedId, setDraggedId] = useState<string>();
  const activeCount = categories.filter((category) => category.status === "ACTIVE").length;
  return <section aria-labelledby="landing-categories-title" aria-busy={isPending} className="my-6 rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-5 text-[var(--ds-text)] shadow-sm sm:p-6" data-slot="landing-categories">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="m-0 text-lg font-bold" id="landing-categories-title">Categorías importantes de la landing</h2>
      <p className="m-0 font-mono text-sm">{categories.length}/3 seleccionadas</p>
    </div>
    <p className="text-sm text-[var(--ds-text-muted)]" id="landing-categories-help">Selecciona entre dos y tres categorías activas con la estrella del listado. Arrastra el botón de una categoría sobre otra para intercambiar posiciones, o usa las flechas con teclado o pantalla táctil. Cada cambio se guarda automáticamente.</p>
    {isLoading ? <LoadingState message="Consultando selección editorial…" /> : error ? <ErrorState message="No pudimos cargar las categorías importantes." action={<button className="font-bold underline" onClick={onRetry} type="button">Reintentar selección editorial</button>} /> : <>
      {activeCount < 2 ? <p className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-subtle)] p-3 text-sm" role="status">Configuración incompleta: selecciona al menos dos categorías activas. Actualmente hay {activeCount}.</p> : null}
      {categories.some((category) => category.status !== "ACTIVE") ? <p className="text-sm" role="status">Las selecciones inactivas no aparecen en la tienda y ocupan una posición. Retíralas antes de reutilizarla.</p> : null}
      {categories.length ? <ol aria-describedby="landing-categories-help" aria-label="Orden de categorías importantes" className="m-0 grid list-none gap-3 p-0">
        {categories.map((category, index) => <li key={category.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-subtle)] p-3" data-category-id={category.id} onDragOver={(event) => { if (ready && category.status === "ACTIVE" && draggedId !== category.id) event.preventDefault(); }} onDrop={(event) => {
          event.preventDefault();
          if (draggedId) onSwap(draggedId, category.id);
          setDraggedId(undefined);
        }}>
          <span className="font-mono text-sm font-bold" aria-label={`Posición ${category.landingOrder}`}>{category.landingOrder}</span>
          <button aria-label={`Arrastrar ${category.name} para intercambiar posición`} aria-describedby="landing-categories-help" className="min-h-11 min-w-11 cursor-grab rounded-lg border border-[var(--ds-border)] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)] disabled:cursor-not-allowed disabled:opacity-60" disabled={!ready || category.status !== "ACTIVE"} draggable={ready && category.status === "ACTIVE"} type="button" onDragStart={(event) => {
            if (!ready || category.status !== "ACTIVE") { event.preventDefault(); return; }
            setDraggedId(category.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", category.id);
          }} onDragEnd={() => setDraggedId(undefined)}><span className="flex justify-center"><Icon name="grip" /></span></button>
          <div className="min-w-0 flex-1 basis-24"><p className="m-0 break-words font-bold">{category.name}</p><p className="m-0 text-xs text-[var(--ds-text-muted)]">{category.status === "ACTIVE" ? "Activa" : "Inactiva · no visible en tienda"}</p></div>
          <div className="flex gap-2">
            <IconButton icon="chevron-up" label={`Subir ${category.name}`} disabled={!ready || category.status !== "ACTIVE" || index === 0 || categories[index - 1]?.status !== "ACTIVE"} onClick={() => onSwap(category.id, categories[index - 1]!.id)} />
            <IconButton icon="chevron-down" label={`Bajar ${category.name}`} disabled={!ready || category.status !== "ACTIVE" || index === categories.length - 1 || categories[index + 1]?.status !== "ACTIVE"} onClick={() => onSwap(category.id, categories[index + 1]!.id)} />
            <IconButton icon="x" label={`Retirar ${category.name} de la landing`} disabled={!ready} onClick={() => onWithdraw(category)} />
          </div>
        </li>)}
      </ol> : <p className="mb-0 text-sm text-[var(--ds-text-muted)]">No hay categorías seleccionadas. Inclúyelas desde el listado inferior.</p>}
    </>}
  </section>;
}
