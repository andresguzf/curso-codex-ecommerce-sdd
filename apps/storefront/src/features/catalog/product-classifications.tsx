import type { ProductListItem } from "@technology-ecommerce/api-schemas";
import Link from "next/link";

type ProductClassification = NonNullable<ProductListItem["category"]>;

function classificationLink(kind: "categoryId" | "tagIds", id: string): string {
  const params = new URLSearchParams({ page: "1", [kind]: id });
  return `/products?${params.toString()}`;
}

export function ProductClassifications({
  category,
  compact = false,
  tags,
}: Readonly<{
  category: ProductClassification | null;
  compact?: boolean;
  tags: readonly ProductClassification[];
}>) {
  const visibleCategory = category?.status === "ACTIVE" ? category : null;
  const visibleTags = tags.filter((tag) => tag.status === "ACTIVE");

  if (compact) {
    if (!visibleCategory && visibleTags.length === 0) return null;
    const previewTags = visibleTags.slice(0, 2);

    return (
      <div aria-label="Clasificación del producto" className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        {visibleCategory ? <Link aria-label={`Ver productos de la categoría ${visibleCategory.name}`} className="rounded-full bg-[var(--ds-accent-soft)] px-2.5 py-1 text-[var(--ds-accent)] hover:bg-[var(--ds-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)]" href={classificationLink("categoryId", visibleCategory.id)}>{visibleCategory.name}</Link> : null}
        {previewTags.map((tag) => <Link aria-label={`Ver productos con la etiqueta ${tag.name}`} className="rounded-full border border-[var(--ds-border)] px-2.5 py-1 text-[var(--ds-text-muted)] hover:border-[var(--ds-accent)] hover:text-[var(--ds-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)]" href={classificationLink("tagIds", tag.id)} key={tag.id}>{tag.name}</Link>)}
        {visibleTags.length > previewTags.length ? <span className="text-[var(--ds-text-muted)]">+{visibleTags.length - previewTags.length} etiquetas</span> : null}
      </div>
    );
  }

  return (
    <section aria-label="Clasificación del producto" className="mt-6 grid gap-3 rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface-subtle)] p-4 text-sm sm:grid-cols-[6rem_minmax(0,1fr)]">
      <p className="m-0 font-bold text-[var(--ds-text-muted)]">Categoría</p>
      {visibleCategory ? <Link className="w-fit font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)]" href={classificationLink("categoryId", visibleCategory.id)}>{visibleCategory.name}</Link> : <p className="m-0 text-[var(--ds-text-muted)]">Sin categoría asignada</p>}
      <p className="m-0 font-bold text-[var(--ds-text-muted)]">Etiquetas</p>
      {visibleTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {visibleTags.map((tag) => <Link aria-label={`Ver productos con la etiqueta ${tag.name}`} className="rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-1 font-semibold text-[var(--ds-text-muted)] hover:border-[var(--ds-accent)] hover:text-[var(--ds-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)]" href={classificationLink("tagIds", tag.id)} key={tag.id}>{tag.name}</Link>)}
        </div>
      ) : <p className="m-0 text-[var(--ds-text-muted)]">Sin etiquetas asignadas</p>}
    </section>
  );
}
