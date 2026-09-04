import { CatalogLanding } from "@/features/catalog/catalog-landing";
import { LoadingState } from "@technology-ecommerce/ui";
import { Suspense } from "react";

export default function StorefrontHomePage() {
  return (
    <Suspense fallback={(
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-14 lg:px-10">
        <LoadingState message="Preparando el catálogo…" />
      </main>
    )}>
      <CatalogLanding />
    </Suspense>
  );
}
