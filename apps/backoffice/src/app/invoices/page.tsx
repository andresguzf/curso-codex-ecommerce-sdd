import { Suspense } from "react";

import { LoadingState } from "@technology-ecommerce/ui";
import { InvoicesManagementPage } from "@/features/invoices/invoice-management";

export default function InvoicesPage() {
  return <Suspense fallback={<LoadingState message="Cargando facturación…" />}><InvoicesManagementPage /></Suspense>;
}
