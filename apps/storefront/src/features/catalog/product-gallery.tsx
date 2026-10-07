"use client";

import type { ProductDetail } from "@technology-ecommerce/api-schemas";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { ProductImage } from "./product-image";

type GalleryImage = ProductDetail["images"][number];
type GalleryProps = Readonly<{ images: readonly GalleryImage[]; productName: string }>;

const focusStyle = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-surface)]";

/** A manual carousel: selection never changes the persisted product cover. */
export function ProductGallery({ images, productName }: GalleryProps) {
  const initialIndex = Math.max(0, images.findIndex((image) => image.isPrimary));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([]);
  const imageId = useId();
  const instructionsId = useId();
  const selected = images[selectedIndex];
  const multiple = images.length > 1;

  function move(offset: number) {
    setSelectedIndex((current) => (current + offset + images.length) % images.length);
  }

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    if (!multiple || event.altKey || event.ctrlKey || event.metaKey) return;
    const next = event.key === "ArrowRight" ? (selectedIndex + 1) % images.length
      : event.key === "ArrowLeft" ? (selectedIndex - 1 + images.length) % images.length
        : event.key === "Home" ? 0 : event.key === "End" ? images.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    setSelectedIndex(next);
    if (thumbnails.current.includes(event.target as HTMLButtonElement)) thumbnails.current[next]?.focus();
  }

  return (
    <section
      aria-label={`Imágenes de ${productName}`}
      aria-roledescription={multiple ? "carrusel" : undefined}
      className="min-w-0 rounded-3xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-subtle)] p-3 sm:p-5"
      data-slot="product-gallery"
      onKeyDown={handleKey}
    >
      <div
        aria-describedby={multiple ? instructionsId : undefined}
        aria-label="Imagen del producto"
        className={`relative aspect-square w-full touch-pan-y overflow-hidden rounded-2xl bg-[var(--ds-surface-subtle)] ${focusStyle}`}
        data-slot="gallery-stage"
        id={imageId}
        onTouchStart={(event) => {
          const touch = event.touches.length === 1 ? event.touches[0] : undefined;
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          const end = event.changedTouches[0];
          if (!multiple || !start || !end) return;
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
        }}
        tabIndex={multiple ? 0 : undefined}
      >
        <ProductImage
          alt={selected?.altText ?? productName}
          className="object-contain p-2 sm:p-4"
          draggable={false}
          fill
          key={selected?.id ?? "fallback"}
          loading={selectedIndex === initialIndex ? "eager" : "lazy"}
          sizes="(min-width: 1280px) 600px, (min-width: 1024px) 50vw, 100vw"
          src={selected?.url}
        />
      </div>
      {multiple ? (
        <>
          <p className="sr-only" id={instructionsId}>Usa las flechas izquierda y derecha, Inicio y Fin, o desliza horizontalmente para cambiar de imagen.</p>
          <div className="flex items-center justify-between gap-3 py-4">
            <button aria-controls={imageId} aria-label="Imagen anterior" className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] text-xl text-[var(--ds-text)] hover:bg-[var(--ds-accent-soft)] ${focusStyle}`} onClick={() => move(-1)} type="button"><span aria-hidden="true">←</span></button>
            <p aria-atomic="true" aria-live="polite" className="m-0 text-center font-mono text-sm font-bold text-[var(--ds-text)]" role="status">Imagen {selectedIndex + 1} de {images.length}</p>
            <button aria-controls={imageId} aria-label="Imagen siguiente" className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] text-xl text-[var(--ds-text)] hover:bg-[var(--ds-accent-soft)] ${focusStyle}`} onClick={() => move(1)} type="button"><span aria-hidden="true">→</span></button>
          </div>
          <div aria-label="Seleccionar imagen" className="flex gap-3 overflow-x-auto p-1 pb-3" data-slot="gallery-thumbnails" role="group">
            {images.map((image, index) => (
              <button
                aria-controls={imageId}
                aria-label={`Ver imagen ${index + 1}: ${image.altText}`}
                aria-pressed={selectedIndex === index}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-[var(--ds-surface)] ${selectedIndex === index ? "border-[var(--ds-accent)]" : "border-[var(--ds-border)]"} ${focusStyle}`}
                key={image.id}
                onClick={() => setSelectedIndex(index)}
                ref={(element) => { thumbnails.current[index] = element; }}
                type="button"
              >
                <ProductImage alt="" className="object-contain p-1" fill loading="lazy" sizes="80px" src={image.url} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
