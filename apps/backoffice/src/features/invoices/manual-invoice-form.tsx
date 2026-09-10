"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createManualInvoiceRequestSchema, type CreateManualInvoiceRequest } from "@technology-ecommerce/api-schemas";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

const money = z.string().regex(/^\d{1,12}\.\d{2}$/, "Usa un importe con dos decimales, por ejemplo 100.00.");
const lineSchema = z.object({
  productId: z.string().optional(),
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser mayor que cero."),
  unitPrice: money,
  taxRate: z.string().regex(/^\d{1,3}\.\d{4}$/, "Usa una tasa con cuatro decimales, por ejemplo 19.0000."),
}).superRefine((line, context) => {
  if (!line.productId?.trim() && !line.name) context.addIssue({ code: "custom", path: ["name"], message: "Indica el nombre de la línea personalizada." });
  if (!line.productId?.trim() && !line.description) context.addIssue({ code: "custom", path: ["description"], message: "Indica la descripción de la línea personalizada." });
  if (line.productId?.trim() && !z.uuid().safeParse(line.productId.trim()).success) context.addIssue({ code: "custom", path: ["productId"], message: "Debe ser un UUID de producto válido." });
});
const formSchema = z.object({
  customerId: z.string().trim().refine((value) => z.uuid().safeParse(value).success, "Debe ser un UUID de cliente válido."),
  shippingTotal: money,
  lines: z.array(lineSchema).min(1, "Agrega al menos una línea."),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;
const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200 aria-invalid:border-red-700";

function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <p className="m-0 text-sm font-semibold text-red-700" role="alert">{message}</p> : null;
}

export function ManualInvoiceForm({ isPending, onCancel, onSubmit }: Readonly<{ isPending: boolean; onCancel: () => void; onSubmit: (input: CreateManualInvoiceRequest) => void }>) {
  const { control, formState, handleSubmit, register } = useForm<FormInput, unknown, FormValues>({
    defaultValues: { customerId: "", shippingTotal: "0.00", lines: [{ productId: "", name: "", description: "", quantity: 1, unitPrice: "", taxRate: "0.0000" }] },
    resolver: zodResolver(formSchema),
  });
  const { append, fields, remove } = useFieldArray({ control, name: "lines" });
  return (
    <form className="grid gap-5" noValidate onSubmit={handleSubmit((values) => {
      const parsed = createManualInvoiceRequestSchema.safeParse({
        customerId: values.customerId.trim(),
        shippingTotal: values.shippingTotal,
        lines: values.lines.map((line) => ({ productId: line.productId?.trim() ? line.productId.trim() : null, name: line.name?.trim() || undefined, description: line.description?.trim() || undefined, quantity: line.quantity, unitPrice: line.unitPrice, taxRate: line.taxRate })),
      });
      if (parsed.success) onSubmit(parsed.data);
    })}>
      <div className="grid gap-2"><label className="text-sm font-semibold" htmlFor="invoice-customer-id">ID del cliente</label><input aria-invalid={Boolean(formState.errors.customerId)} className={inputClass} id="invoice-customer-id" placeholder="UUID del cliente CUSTOMER" {...register("customerId")} /><FieldError message={formState.errors.customerId?.message} /><p className="m-0 text-xs text-slate-500">El autocomplete remoto de clientes se incorporará en la tarea 17.3.</p></div>
      <div className="grid max-w-xs gap-2"><label className="text-sm font-semibold" htmlFor="invoice-shipping">Envío (USD)</label><input aria-invalid={Boolean(formState.errors.shippingTotal)} className={inputClass} id="invoice-shipping" inputMode="decimal" {...register("shippingTotal")} /><FieldError message={formState.errors.shippingTotal?.message} /></div>
      <fieldset className="grid gap-4"><legend className="text-lg font-bold">Líneas de factura</legend>{fields.map((field, index) => { const lineErrors = formState.errors.lines?.[index]; return <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4" key={field.id}><div className="flex items-center justify-between gap-3"><h3 className="m-0 text-sm font-bold">Línea {index + 1}</h3>{fields.length > 1 ? <button className="text-sm font-bold text-red-700 underline" onClick={() => remove(index)} type="button">Quitar línea</button> : null}</div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1"><label className="text-sm font-semibold" htmlFor={`invoice-line-${index}-product`}>ID de producto (opcional)</label><input className={inputClass} id={`invoice-line-${index}-product`} placeholder="UUID; vacío para línea manual" {...register(`lines.${index}.productId`)} /><FieldError message={lineErrors?.productId?.message} /></div><div className="grid gap-1"><label className="text-sm font-semibold" htmlFor={`invoice-line-${index}-name`}>Nombre</label><input aria-invalid={Boolean(lineErrors?.name)} className={inputClass} id={`invoice-line-${index}-name`} {...register(`lines.${index}.name`)} /><FieldError message={lineErrors?.name?.message} /></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1"><label className="text-sm font-semibold" htmlFor={`invoice-line-${index}-description`}>Descripción</label><textarea aria-invalid={Boolean(lineErrors?.description)} className={`${inputClass} min-h-20 resize-y`} id={`invoice-line-${index}-description`} {...register(`lines.${index}.description`)} /><FieldError message={lineErrors?.description?.message} /></div><div className="grid gap-3"><div className="grid gap-1"><label className="text-sm font-semibold" htmlFor={`invoice-line-${index}-quantity`}>Cantidad</label><input aria-invalid={Boolean(lineErrors?.quantity)} className={inputClass} id={`invoice-line-${index}-quantity`} min={1} type="number" {...register(`lines.${index}.quantity`)} /><FieldError message={lineErrors?.quantity?.message} /></div><div className="grid gap-3 sm:grid-cols-2"><div><label className="text-sm font-semibold" htmlFor={`invoice-line-${index}-price`}>Precio unitario (USD)</label><input aria-invalid={Boolean(lineErrors?.unitPrice)} className={inputClass} id={`invoice-line-${index}-price`} inputMode="decimal" {...register(`lines.${index}.unitPrice`)} /><FieldError message={lineErrors?.unitPrice?.message} /></div><div><label className="text-sm font-semibold" htmlFor={`invoice-line-${index}-tax`}>Impuesto</label><input aria-invalid={Boolean(lineErrors?.taxRate)} className={inputClass} id={`invoice-line-${index}-tax`} inputMode="decimal" {...register(`lines.${index}.taxRate`)} /><FieldError message={lineErrors?.taxRate?.message} /></div></div></div></div></div>; })}</fieldset>
      {typeof formState.errors.lines?.message === "string" ? <FieldError message={formState.errors.lines.message} /> : null}
      <button className="w-fit rounded-lg border border-blue-300 px-4 py-2 font-bold text-blue-800 hover:bg-blue-50" onClick={() => append({ productId: "", name: "", description: "", quantity: 1, unitPrice: "", taxRate: "0.0000" })} type="button">+ Agregar línea</button>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5"><button className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold" disabled={isPending} onClick={onCancel} type="button">Cancelar</button><button className="min-h-11 rounded-lg bg-[#15345b] px-5 py-2 font-bold text-white disabled:cursor-wait disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Creando…" : "Crear factura manual"}</button></div>
    </form>
  );
}
