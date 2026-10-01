import type { LandingProduct } from "@technology-ecommerce/api-schemas";
import Link from "next/link";

import { ProductGrid } from "./product-grid";

/** One editorial section; ordering and eligibility are owned by the REST API. */
export function LandingProductSection({ id, title, eyebrow, description, products, featured = false, categoryId, isAdding, onAddToCart }: Readonly<{
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  products: readonly LandingProduct[];
  featured?: boolean;
  categoryId?: string;
  isAdding: boolean;
  onAddToCart: (product: Pick<LandingProduct, "id" | "name">) => void;
}>) {
  if (!products.length) return null;
  return <section aria-labelledby={`${id}-title`} id={id} data-slot={featured ? "landing-featured" : "landing-category"}
    className={featured ? "border-y border-[var(--ds-border)] bg-[var(--ds-accent-soft)]" : "border-t border-[var(--ds-border)]"}>
    <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10 lg:py-20">
      <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="m-0 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[var(--ds-accent)]">{eyebrow}</p>
          <h2 className="mb-0 mt-2 text-3xl font-black tracking-tight text-[var(--ds-text)] sm:text-4xl" id={`${id}-title`}>{title}</h2>
          <p className="mb-0 mt-3 text-sm text-[var(--ds-text-muted)]">{description}</p>
        </div>
        {categoryId ? <Link className="inline-flex min-h-11 items-center gap-3 self-start rounded-lg px-1 text-sm font-bold text-[var(--ds-accent)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ds-focus)]"
          href={`/products?${new URLSearchParams({ page: "1", categoryId }).toString()}`}>
          Explorar {title}<span aria-hidden="true">→</span>
        </Link> : null}
      </div>
      <ProductGrid isAdding={isAdding} onAddToCart={onAddToCart} products={products} />
    </div>
  </section>;
}
