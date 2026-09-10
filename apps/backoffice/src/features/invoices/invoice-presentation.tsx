import type { InvoiceResponse, InvoiceStatus as InvoiceStatusValue } from "@technology-ecommerce/api-schemas";

export const invoiceStatusLabels: Record<InvoiceStatusValue, string> = {
  DRAFT: "Borrador",
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagada",
  VOID: "Anulada",
};

const statusClasses: Record<InvoiceStatusValue, string> = {
  DRAFT: "bg-slate-200 text-slate-800",
  PENDING_PAYMENT: "bg-amber-100 text-amber-900",
  PAID: "bg-emerald-100 text-emerald-800",
  VOID: "bg-red-100 text-red-800",
};

export function InvoiceStatus({ status }: Readonly<{ status: InvoiceStatusValue }>) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[status]}`}>{invoiceStatusLabels[status]}</span>;
}

export function formatInvoiceMoney(value: string) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(Number(value));
}

export function formatInvoiceDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value)) : "No emitida";
}

export function snapshotText(snapshot: InvoiceResponse["customerSnapshot"], field: string) {
  const value = snapshot[field];
  return typeof value === "string" && value.trim() ? value : "No registrado";
}
