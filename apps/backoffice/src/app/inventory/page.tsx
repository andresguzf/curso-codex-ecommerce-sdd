import { Suspense } from "react";

import { LoadingState } from "@technology-ecommerce/ui";

import { InventoryBalanceManagement } from "@/features/inventory/inventory-balance-management";

export default function InventoryPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoadingState message="Preparando inventario…" /></main>}>
      <InventoryBalanceManagement />
    </Suspense>
  );
}
