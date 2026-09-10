import { Suspense } from "react";

import { LoadingState } from "@technology-ecommerce/ui";
import { InvoiceDetailPage } from "@/features/invoices/invoice-detail";

export default async function InvoiceDetailRoute({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return <Suspense fallback={<LoadingState message="Cargando factura…" />}><InvoiceDetailPage invoiceId={invoiceId} /></Suspense>;
}
