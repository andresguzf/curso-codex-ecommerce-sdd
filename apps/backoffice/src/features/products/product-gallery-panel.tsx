"use client";

import type { CatalogImage, UpdateProductImageRequest } from "@technology-ecommerce/api-schemas";
import { ConfirmationDialog, ErrorState, Icon, IconButton, LoadingState } from "@technology-ecommerce/ui";
import { useId, useState } from "react";

import { ProductImageApiError } from "./product-image-api";
import { useProductGallery } from "./use-product-gallery";
import { ProductImageUpload } from "./product-image-upload";
import { useSessionStore } from "../auth/session";
import { useProductImageMutations } from "./use-product-image-mutations";
import { ProductImageControls } from "./product-image-controls";

function imageSource(source: string): string | null {
  // The legacy placeholder belongs to the storefront, not this application.
  if (source === "/images/product-placeholder.svg") return null;
  try {
    const url = new URL(source, process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001");
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function GalleryThumbnail({ image }: Readonly<{ image: CatalogImage }>) {
  const [failed, setFailed] = useState(false);
  const source = imageSource(image.url);
  return <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-[var(--ds-surface-subtle)]">
    {source && !failed ? (
      // Native image avoids Next host allowlists for admin-managed references.
      // Render stored image references without Next.js remote-host restrictions.
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={image.altText} className="h-full w-full object-contain" decoding="async" height={image.height ?? 600} loading="lazy" onError={() => setFailed(true)} referrerPolicy="no-referrer" src={source} width={image.width ?? 800} />
    ) : <span aria-label={image.altText} className="px-3 text-center text-sm text-[var(--ds-text-muted)]" role="img">Imagen no disponible</span>}
  </div>;
}

/** Administrative gallery; all writes use the same serialized REST mutation. */
export function ProductGalleryPanel({ productId, disabled = false, onPendingChange }: Readonly<{ productId?: string; disabled?: boolean; onPendingChange?: (pending: boolean) => void }>) {
  const headingId = useId();
  const actorId = useSessionStore((state) => state.session?.user.id);
  const [draggedId, setDraggedId] = useState<string>();
  const [removal, setRemoval] = useState<{ imageId: string; altText: string; actorId: string | undefined; productId: string | undefined; neighborId?: string }>();
  const { authorized, query } = useProductGallery(productId);
  const mutations = useProductImageMutations(productId ?? "", onPendingChange);
  const busy = disabled || query.isFetching || mutations.isPending;
  if (!authorized) return null;
  const images = query.data?.images ?? [];
  const oversized = images.length > 4;
  const selected = removal?.actorId === actorId && removal?.productId === productId ? removal : undefined;
  async function remove() {
    if (!selected || busy) return;
    await mutations.remove(selected.imageId);
    setRemoval(undefined);
    requestAnimationFrame(() => {
      if (useSessionStore.getState().session?.user.id !== actorId) return;
      const original = document.getElementById(`${headingId}-${selected.imageId}-handle`);
      const neighbor = document.getElementById(`${headingId}-${selected.neighborId}-handle`);
      (original ?? neighbor ?? document.getElementById(`${headingId}-retry`) ?? document.getElementById(`${headingId}-panel`))?.focus();
    });
  }
  async function update(imageId: string, input: UpdateProductImageRequest) {
    if (busy) return false;
    const result = await mutations.update(imageId, input);
    requestAnimationFrame(() => {
      if (useSessionStore.getState().session?.user.id !== actorId) return;
      const handle = document.getElementById(`${headingId}-${imageId}-handle`);
      const retry = document.getElementById(`${headingId}-retry`);
      (handle ?? retry ?? document.getElementById(`${headingId}-panel`))?.focus();
    });
    return Boolean(result);
  }
  return <section aria-busy={mutations.isPending} aria-labelledby={headingId} className="min-w-0 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4 text-[var(--ds-text)] focus-visible:outline-2 focus-visible:outline-[var(--ds-focus)] sm:p-5" data-slot="product-gallery-panel" id={`${headingId}-panel`} tabIndex={-1}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ds-border)] pb-4">
      <div>
        <h3 className="m-0 text-lg font-bold tracking-tight" id={headingId}>Galería de imágenes</h3>
        <p className="mb-0 mt-1 text-sm text-[var(--ds-text-muted)]">Una portada y hasta tres imágenes adicionales.</p>
      </div>
      {productId && query.data && !query.isError ? <span aria-label={`${images.length} de 4 imágenes`} className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-accent-soft)] px-3 py-2 font-mono text-sm font-bold text-[var(--ds-text)]">{images.length}/4 imágenes</span> : null}
    </header>
    <div aria-live="polite" className="mt-4">
      {!productId ? <p className="m-0 text-sm text-[var(--ds-text-muted)]">Guarda primero el producto para habilitar su galería. Se utilizará una portada genérica hasta agregar imágenes.</p>
        : query.isPending ? <LoadingState message="Cargando galería…" />
          : query.isError ? <ErrorState action={query.error instanceof ProductImageApiError && [401, 403].includes(query.error.status) ? undefined : <button id={`${headingId}-retry`} className="min-h-11 rounded-lg border border-[var(--ds-border)] px-4 font-semibold text-[var(--ds-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)]" onClick={() => { void query.refetch(); }} type="button">Reintentar galería</button>} message={query.error instanceof ProductImageApiError ? query.error.message : "No se pudieron cargar las imágenes. Reintenta la consulta."} title="No se pudo cargar la galería" />
            : !images.length ? <p className="m-0 rounded-lg bg-[var(--ds-surface-subtle)] p-4 text-sm text-[var(--ds-text-muted)]">Este producto todavía no tiene imágenes.</p>
              : <>
                {oversized ? <p className="mb-4 mt-0 rounded-lg border border-[var(--ds-warning)] bg-[var(--ds-warning-soft)] p-3 text-sm text-[var(--ds-warning)]" role="status">Esta galería anterior tiene {images.length} imágenes y supera el máximo de cuatro. Se conservan todas; no se podrán agregar nuevas hasta tener menos de cuatro.</p> : null}
                {!images.some((image) => image.isPrimary) ? <p className="mb-4 mt-0 text-sm text-[var(--ds-warning)]">Este producto no tiene una portada seleccionada.</p> : null}
                <p className="text-xs text-[var(--ds-text-muted)]" id={`${headingId}-order-help`}>Arrastra el asa sobre otra imagen para moverla a esa posición, o usa Subir/Bajar con el teclado. Cada cambio se guarda por separado.</p>
                <ol aria-describedby={`${headingId}-order-help`} aria-label="Imágenes del producto en orden" className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
                  {images.map((image, index) => <li className={`min-w-0 rounded-xl border p-3 ${image.isPrimary ? "border-[var(--ds-accent)] bg-[var(--ds-accent-soft)]" : "border-[var(--ds-border)] bg-[var(--ds-surface)]"}`} key={image.id} onDragOver={(event) => { if (!busy && draggedId && draggedId !== image.id) event.preventDefault(); }} onDrop={(event) => {
                    event.preventDefault();
                    if (!busy && draggedId && draggedId !== image.id && images.some((entry) => entry.id === draggedId)) void update(draggedId, { sortOrder: index });
                    setDraggedId(undefined);
                  }}>
                    <GalleryThumbnail image={image} key={`${image.id}:${image.url}`} />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                      <span className="text-[var(--ds-text-muted)]">Posición {index + 1}</span>
                      <span className={image.isPrimary ? "font-bold text-[var(--ds-accent)]" : "text-[var(--ds-text-muted)]"}>{image.isPrimary ? "Portada" : "Adicional"}</span>
                    </div>
                    <p className="mb-0 mt-2 break-words text-sm">{image.altText}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button aria-describedby={`${headingId}-order-help`} aria-label={`Arrastrar ${image.altText} para ordenar`} className="flex size-10 shrink-0 cursor-grab items-center justify-center rounded-lg border border-[var(--ds-border)] text-[var(--ds-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)] disabled:opacity-60" disabled={busy} draggable={!busy} id={`${headingId}-${image.id}-handle`} onDragEnd={() => setDraggedId(undefined)} onDragStart={(event) => {
                        if (busy) { event.preventDefault(); return; }
                        setDraggedId(image.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", image.id);
                      }} type="button"><Icon name="grip" /></button>
                      <IconButton disabled={busy || index === 0} icon="chevron-up" label={`Subir ${image.altText}`} onClick={() => { void update(image.id, { sortOrder: index - 1 }); }} />
                      <IconButton disabled={busy || index === images.length - 1} icon="chevron-down" label={`Bajar ${image.altText}`} onClick={() => { void update(image.id, { sortOrder: index + 1 }); }} />
                      <IconButton disabled={busy || (query.data?.status === "ACTIVE" && image.isPrimary)} icon="trash" label={`Eliminar ${image.altText}`} onClick={() => setRemoval({ imageId: image.id, altText: image.altText, actorId, productId, neighborId: (images[index + 1] ?? images[index - 1])?.id })} />
                    </div>
                    {query.data?.status === "ACTIVE" && image.isPrimary ? <p className="mb-0 mt-2 text-xs text-[var(--ds-text-muted)]">El producto activo debe conservar una portada. Selecciona otra antes de eliminar esta imagen.</p> : null}
                    <ProductImageControls altText={image.altText} disabled={busy} first={index === 0} key={`${actorId}:${productId}:${image.id}:${image.altText}`} last={index === images.length - 1} onUpdate={(input) => update(image.id, input)} primary={image.isPrimary} />
                  </li>)}
                </ol>
              </>}
    </div>
    {productId && query.data && !query.isError ? <ProductImageUpload disabled={busy} full={images.length >= 4} key={`${actorId}:${productId}`} upload={mutations} /> : null}
    <ConfirmationDialog confirmLabel="Eliminar imagen" description={`Se eliminará «${selected?.altText ?? ""}» de la galería. Esta acción no modifica los datos comerciales ni el inventario.`} isPending={mutations.isPending} onCancel={() => { if (!mutations.isPending) setRemoval(undefined); }} onConfirm={remove} open={Boolean(selected)} title="Eliminar imagen del producto" />
  </section>;
}
