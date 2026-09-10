import { Suspense } from "react";

import { LoadingState } from "@technology-ecommerce/ui";
import { InvoicesPage } from "@/features/invoices/invoices-page";

export default function MyInvoicesPage() {
  return <Suspense fallback={<LoadingState message="Cargando tus facturas…" />}><InvoicesPage /></Suspense>;
}
