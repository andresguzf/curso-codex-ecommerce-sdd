import { Suspense } from "react";
import { LoadingState } from "@technology-ecommerce/ui";
import { OrdersPage } from "@/features/orders/orders-page";

export default function MyOrdersPage() {
  return <Suspense fallback={<LoadingState message="Cargando tus compras…" />}><OrdersPage /></Suspense>;
}
