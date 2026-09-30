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
        {visibleCategory ? <Link aria-label={`Ver productos de la categoría ${visibleCategory.name}`} className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" href={classificationLink("categoryId", visibleCategory.id)}>{visibleCategory.name}</Link> : null}
        {previewTags.map((tag) => <Link aria-label={`Ver productos con la etiqueta ${tag.name}`} className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-700 hover:border-blue-300 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" href={classificationLink("tagIds", tag.id)} key={tag.id}>{tag.name}</Link>)}
        {visibleTags.length > previewTags.length ? <span className="text-slate-500">+{visibleTags.length - previewTags.length} etiquetas</span> : null}
      </div>
    );
  }

  return (
    <section aria-label="Clasificación del producto" className="mt-7 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
      <p className="m-0 font-bold text-slate-700">Categoría</p>
      {visibleCategory ? <Link className="w-fit font-semibold text-blue-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" href={classificationLink("categoryId", visibleCategory.id)}>{visibleCategory.name}</Link> : <p className="m-0 text-slate-500">Sin categoría asignada</p>}
      <p className="m-0 font-bold text-slate-700">Etiquetas</p>
      {visibleTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {visibleTags.map((tag) => <Link aria-label={`Ver productos con la etiqueta ${tag.name}`} className="rounded-full border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" href={classificationLink("tagIds", tag.id)} key={tag.id}>{tag.name}</Link>)}
        </div>
      ) : <p className="m-0 text-slate-500">Sin etiquetas asignadas</p>}
    </section>
  );
}
