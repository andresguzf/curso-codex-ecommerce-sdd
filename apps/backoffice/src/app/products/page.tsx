import { Suspense } from "react";

import { LoadingState } from "@technology-ecommerce/ui";
import { ProductManagement } from "@/features/products/product-management";

export default function ProductsPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoadingState message="Preparando catálogo…" /></main>}>
      <ProductManagement />
    </Suspense>
  );
}
