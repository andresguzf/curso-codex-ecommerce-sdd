import { Suspense } from "react";
import { LoadingState } from "@technology-ecommerce/ui";
import { OrdersManagementPage } from "@/features/orders/orders-management";

export default function OrdersPage() {
  return <Suspense fallback={<LoadingState message="Cargando gestión de órdenes…" />}><OrdersManagementPage /></Suspense>;
}
