"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { checkoutRequestSchema, type CheckoutRequest } from "@technology-ecommerce/api-schemas";
import { LoadingState, TextField } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";

import { useSessionStore } from "../auth/session";
import { useCart } from "../cart/use-cart";
import { formatProductPrice } from "../catalog/catalog-format";
import { CheckoutApiError, getCheckoutShippingOptions } from "./checkout-api";
import { useCheckout } from "./use-checkout";

const shippingLabels = { PICKUP: "Retiro en tienda", STANDARD: "Envío estándar", EXPRESS: "Envío express" };
const addressFields = [
  ["recipientName", "Nombre de quien recibe", "name"],
  ["line1", "Dirección", "address-line1"],
  ["city", "Ciudad", "address-level2"],
  ["region", "Región o estado", "address-level1"],
  ["postalCode", "Código postal", "postal-code"],
  ["countryCode", "País (código de dos letras)", "country"],
] as const;

function totalWithShipping(subtotal: string, shipping: string): string {
  const cents = (value: string) => BigInt(value.replace(".", ""));
  const total = cents(subtotal) + cents(shipping);
  return `${total / BigInt(100)}.${String(total % BigInt(100)).padStart(2, "0")}`;
}

export function CheckoutForm() {
  const session = useSessionStore((state) => state.session)!;
  const { cartQuery } = useCart();
  const { confirm, uncertain, mutation } = useCheckout(session.user.id);
  const shipping = useQuery({
    queryKey: ["checkout-shipping", session.user.id],
    queryFn: () => getCheckoutShippingOptions(session.accessToken),
  });
  const form = useForm<CheckoutRequest>({
    resolver: zodResolver(checkoutRequestSchema),
    defaultValues: {
      paymentMethod: "SIMULATED_CARD_APPROVED", shippingMethod: "PICKUP",
      shippingAddress: { recipientName: session.user.displayName, line1: "", city: "", region: "", postalCode: "", countryCode: "CL" },
    },
  });
  const method = useWatch({ control: form.control, name: "shippingMethod" });
  const cart = cartQuery.data;
  const shippingCost = shipping.data?.find((option) => option.method === method)?.cost;
  const unavailable = cart?.items.some((item) => !item.product.isAvailable || item.quantity > item.product.stockAvailable);
  const locked = mutation.isPending || mutation.isSuccess || uncertain;

  if (cartQuery.isPending || shipping.isPending) return <LoadingState message="Preparando tu compra…" />;
  if (cartQuery.isError || shipping.isError) return <div role="alert"><p>No se pudo preparar tu compra.</p><button type="button" onClick={() => { void cartQuery.refetch(); void shipping.refetch(); }}>Reintentar carga</button></div>;
  if (!cart || (!cart.items.length && !uncertain && !mutation.isSuccess)) return <section><h1 className="text-3xl font-black">Tu carrito está vacío</h1><Link href="/" className="font-bold text-blue-700 underline">Explorar productos</Link></section>;

  return (
    <div>
      <Link href="/cart" className="font-bold text-blue-700 underline">← Revisar carrito</Link>
      <header className="mb-9 mt-7"><p className="font-mono text-xs uppercase tracking-widest text-blue-700">Último paso · USD</p><h1 className="text-4xl font-black tracking-tight">Completa tu compra</h1><p className="text-slate-600">Confirma dónde recibir tus productos y elige cómo probar el pago. No se realizarán cobros reales.</p></header>
      <form noValidate onSubmit={(event) => {
        if (uncertain) { event.preventDefault(); void confirm(form.getValues()); }
        else { void form.handleSubmit(confirm)(event); }
      }} className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-7">
          <fieldset disabled={locked} className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <legend className="px-2 text-xl font-bold">Dirección de entrega</legend>
            <div className="grid gap-5 sm:grid-cols-2">{addressFields.map(([field, label, autoComplete]) => (
              <TextField key={field} id={`checkout-${field}`} label={label} autoComplete={autoComplete} required error={form.formState.errors.shippingAddress?.[field]?.message} {...form.register(`shippingAddress.${field}`)} />
            ))}</div>
          </fieldset>
          <fieldset disabled={locked} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <legend className="px-2 text-xl font-bold">Entrega simulada</legend>
            {shipping.data?.map((option) => <label key={option.method} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 has-checked:border-blue-700 has-checked:bg-blue-50"><input type="radio" value={option.method} {...form.register("shippingMethod")} /><span className="flex-1 font-semibold">{shippingLabels[option.method]}</span><span className="font-mono text-sm">{formatProductPrice(option.cost)}</span></label>)}
          </fieldset>
          <fieldset disabled={locked} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <legend className="px-2 text-xl font-bold">Pago de prueba</legend>
            <label className="flex gap-3 rounded-xl border p-4"><input type="radio" value="SIMULATED_CARD_APPROVED" {...form.register("paymentMethod")} />Tarjeta ficticia · aprobar pago</label>
            <label className="flex gap-3 rounded-xl border p-4"><input type="radio" value="SIMULATED_CARD_REJECTED" {...form.register("paymentMethod")} />Tarjeta ficticia · rechazar pago</label>
          </fieldset>
        </div>
        <aside className="rounded-3xl bg-[#081426] p-7 text-white lg:sticky lg:top-8">
          <h2 className="m-0 text-2xl font-black">Tu pedido</h2>
          <ul className="my-6 grid list-none gap-4 p-0">{cart.items.map((item) => <li key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.product.name} × {item.quantity}</span><span>{formatProductPrice(item.subtotal)}</span></li>)}</ul>
          <dl className="grid gap-4 border-t border-white/20 pt-5"><div className="flex justify-between"><dt>Productos</dt><dd>{formatProductPrice(cart.subtotal)}</dd></div><div className="flex justify-between"><dt>Envío</dt><dd>{shippingCost ? formatProductPrice(shippingCost) : "—"}</dd></div><div className="flex justify-between text-xl font-black"><dt>Total (USD)</dt><dd>{shippingCost ? formatProductPrice(totalWithShipping(cart.subtotal, shippingCost)) : "—"}</dd></div></dl>
          <p className="text-xs leading-5 text-slate-300">El precio y la disponibilidad se revisan al confirmar.</p>
          {unavailable && !uncertain ? <p role="alert" className="text-amber-200">Hay productos sin disponibilidad suficiente. Ajusta tu carrito.</p> : null}
          {mutation.error ? <p role="alert" className="rounded-xl border border-amber-300 p-3 text-sm text-amber-100">{mutation.error instanceof CheckoutApiError ? mutation.error.message : "No pudimos confirmar el resultado. Reintenta la misma compra para evitar duplicados."}</p> : null}
          <button type="submit" disabled={mutation.isPending || mutation.isSuccess || (!uncertain && (unavailable || !shippingCost))} className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-50">{mutation.isSuccess ? "Compra confirmada" : mutation.isPending ? "Confirmando…" : uncertain ? "Reintentar la misma compra" : "Confirmar compra simulada"}</button>
        </aside>
      </form>
    </div>
  );
}
