"use client";

import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";

import { useSessionStore } from "../auth/session";
import { formatProductPrice } from "../catalog/catalog-format";
import { checkoutReceiptKey } from "./use-checkout";
import { getCheckoutReceipt } from "./checkout-api";

export function CheckoutReceipt({ orderId }: Readonly<{ orderId: string }>) {
  const session = useSessionStore((state) => state.session)!;
  const query = useQuery({
    queryKey: checkoutReceiptKey(session.user.id, orderId),
    queryFn: () => getCheckoutReceipt(session.accessToken, orderId),
    staleTime: Infinity,
  });
  if (query.isPending) return <LoadingState message="Cargando confirmación…" />;
  const result = query.data;
  if (!result) return <section><h1 className="text-3xl font-black">No se pudo cargar la confirmación</h1><p role="alert">Verifica que corresponda a tu cuenta o vuelve a intentarlo.</p><button type="button" className="mr-5 font-bold text-blue-700 underline" onClick={() => { void query.refetch(); }}>Reintentar</button><Link href="/" className="font-bold text-blue-700 underline">Volver a la tienda</Link></section>;

  return <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-7 sm:p-12">
    <p role="status" className="font-bold text-emerald-800">Compra confirmada · pago simulado aprobado</p>
    <h1 className="text-4xl font-black tracking-tight">Tu pedido está en proceso</h1>
    <p className="break-all font-mono text-sm text-slate-600">{result.order.number}</p>
    <ul className="my-8 grid list-none gap-5 p-0">{result.order.items.map((item) => <li key={item.productId} className="flex justify-between gap-5 border-b border-slate-200 pb-4"><span>{item.name} × {item.quantity}</span><span className="font-bold">{formatProductPrice(item.lineTotal)}</span></li>)}</ul>
    <dl className="grid gap-3"><div className="flex justify-between"><dt>Envío</dt><dd>{formatProductPrice(result.order.shippingTotal)}</dd></div><div className="flex justify-between"><dt>Impuestos</dt><dd>{formatProductPrice(result.order.taxTotal)}</dd></div><div className="flex justify-between text-2xl font-black"><dt>Total (USD)</dt><dd>{formatProductPrice(result.order.total)}</dd></div></dl>
    <p className="mt-6 text-sm text-slate-600">No se realizó ningún cobro real. Conserva el número de tu pedido.</p>
    <div className="mt-5 flex flex-wrap items-center gap-5"><Link href={`/account/orders/${result.order.id}`} className="font-bold text-blue-700 underline">Ver estado de mi pedido</Link><Link href="/" className="inline-flex min-h-12 items-center rounded-xl bg-blue-700 px-6 font-bold text-white">Seguir comprando</Link></div>
  </section>;
}
