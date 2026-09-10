import type { CustomerOrderDetail } from "@technology-ecommerce/api-schemas";
import Link from "next/link";
import { OrdersApiError } from "./orders-api";

export const orderLabels: Record<CustomerOrderDetail["status"], string> = {
  PROCESSING: "En proceso", INVOICED: "Facturada", COMPLETED: "Completada", CANCELLED: "Cancelada",
};
const statusColors = {
  PROCESSING: "bg-blue-50 text-blue-800", INVOICED: "bg-indigo-50 text-indigo-800",
  COMPLETED: "bg-emerald-50 text-emerald-800", CANCELLED: "bg-red-50 text-red-800",
};
export function OrderStatus({ status }: Readonly<{ status: CustomerOrderDetail["status"] }>) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${statusColors[status]}`}>{orderLabels[status]}</span>;
}
export function orderDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(value));
}
export function OrdersError({ error, retry, returnTo }: Readonly<{ error: unknown; retry: () => void; returnTo: string }>) {
  const status = error instanceof OrdersApiError ? error.status : 0;
  return <section className="my-8 rounded-2xl border border-slate-200 bg-white p-6">
    <p role="alert">{error instanceof OrdersApiError ? error.message : "No se pudieron cargar tus compras. Revisa tu conexión y vuelve a intentarlo."}</p>
    <div className="mt-4 flex flex-wrap gap-5 font-bold text-blue-700">
      {status === 401 ? <Link className="underline" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Iniciar sesión</Link>
        : status !== 403 && status !== 404 ? <button type="button" className="underline" onClick={retry}>Reintentar</button> : null}
      <Link href="/account/orders" className="underline">Volver a mis compras</Link>
    </div>
  </section>;
}
