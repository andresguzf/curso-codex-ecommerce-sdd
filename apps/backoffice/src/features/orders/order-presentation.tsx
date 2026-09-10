import type { CustomerOrderDetail } from "@technology-ecommerce/api-schemas";

export const orderStatusLabels: Record<CustomerOrderDetail["status"], string> = {
  PROCESSING: "En proceso", INVOICED: "Facturada", COMPLETED: "Completada", CANCELLED: "Cancelada",
};
const statusClasses: Record<CustomerOrderDetail["status"], string> = {
  PROCESSING: "bg-blue-50 text-blue-800", INVOICED: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800", CANCELLED: "bg-red-50 text-red-800",
};
export function OrderStatus({ status }: Readonly<{ status: CustomerOrderDetail["status"] }>) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[status]}`}>{orderStatusLabels[status]}</span>;
}
export function formatOrderMoney(value: string) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(Number(value));
}
export function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value));
}
export function snapshotText(snapshot: Record<string, unknown>, field: string) {
  const value = snapshot[field];
  return typeof value === "string" && value.trim() ? value : "No registrado";
}
