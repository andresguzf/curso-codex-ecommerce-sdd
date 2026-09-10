import { Suspense } from "react";

import { LoadingState } from "@technology-ecommerce/ui";
import { InvoiceDetailPage } from "@/features/invoices/invoice-detail";

export default async function MyInvoiceDetailPage({ params }: Readonly<{ params: Promise<{ invoiceId: string }> }>) {
  const { invoiceId } = await params;
  return <Suspense fallback={<LoadingState message="Cargando tu factura…" />}><InvoiceDetailPage invoiceId={invoiceId} /></Suspense>;
}
