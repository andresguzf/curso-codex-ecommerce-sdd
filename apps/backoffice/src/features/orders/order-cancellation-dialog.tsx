"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cancelOrderRequestSchema, type CancelOrderRequest } from "@technology-ecommerce/api-schemas";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";

export function OrderCancellationDialog({ isPending, number, onCancel, onConfirm, open }: Readonly<{
  isPending: boolean; number: string; onCancel: () => void; onConfirm: (reason: string) => void; open: boolean;
}>) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const { formState, handleSubmit, register, reset } = useForm<CancelOrderRequest>({ resolver: zodResolver(cancelOrderRequestSchema), defaultValues: { reason: "" } });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !isPending) onCancel(); };
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); previous?.focus(); reset(); };
  }, [isPending, onCancel, open, reset]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" role="presentation">
    <section aria-labelledby="cancel-order-title" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl" role="dialog">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-red-700">Acción irreversible</p><h2 className="mt-2 text-2xl font-bold" id="cancel-order-title">Cancelar orden</h2><p className="mt-3 text-sm text-slate-600">Se cancelará {number} y se restituirá su inventario exactamente una vez. Una factura activa bloqueará la operación.</p>
      <form className="mt-5" onSubmit={handleSubmit(({ reason }) => onConfirm(reason))} noValidate>
        <label className="font-bold" htmlFor="cancellation-reason">Motivo de cancelación</label><textarea id="cancellation-reason" className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 p-3 focus-visible:outline-2 focus-visible:outline-blue-700" maxLength={500} {...register("reason")} />
        <p className="mt-1 min-h-5 text-sm text-red-700" role="alert">{formState.errors.reason ? "Escribe un motivo de 1 a 500 caracteres." : ""}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-3"><button ref={cancelButton} className="rounded-lg border border-slate-300 px-4 py-2 font-bold" disabled={isPending} onClick={onCancel} type="button">Volver</button><button className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Cancelando…" : "Confirmar cancelación"}</button></div>
      </form>
    </section>
  </div>;
}
