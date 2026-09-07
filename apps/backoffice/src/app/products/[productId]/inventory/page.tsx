import { Suspense } from "react";

import { LoadingState } from "@technology-ecommerce/ui";

import { InventoryManagement } from "@/features/inventory/inventory-management";

export default async function InventoryPage({
  params,
}: Readonly<{ params: Promise<{ productId: string }> }>) {
  const { productId } = await params;
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoadingState message="Preparando inventario…" /></main>}>
      <InventoryManagement productId={productId} />
    </Suspense>
  );
}
