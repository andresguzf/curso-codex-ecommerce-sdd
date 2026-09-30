import { LoadingState } from "@technology-ecommerce/ui";
import { Suspense } from "react";

import { CatalogPage } from "@/features/catalog/catalog-page";

export default function ProductsPage() {
  return (
    <Suspense fallback={(
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-14 lg:px-10">
        <LoadingState message="Preparando el catálogo…" />
      </main>
    )}>
      <CatalogPage />
    </Suspense>
  );
}
