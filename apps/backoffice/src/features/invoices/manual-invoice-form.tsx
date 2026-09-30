"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createManualInvoiceRequestSchema, type CreateManualInvoiceRequest } from "@technology-ecommerce/api-schemas";
import { IconButton } from "@technology-ecommerce/ui";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { searchInvoiceCustomers, searchInvoiceProducts } from "./invoice-autocomplete-api";
import { InvoiceEntitySelector } from "./invoice-entity-selector";

const money = z.string().regex(/^\d{1,12}\.\d{2}$/, "Usa un importe con dos decimales, por ejemplo 100.00.");
const lineSchema = z.object({
  productId: z.string().optional(), name: z.string().trim().max(200, "Usa como máximo 200 caracteres.").optional(), description: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1, "La cantidad debe ser mayor que cero.").max(1_000_000),
  unitPrice: money,
  taxRate: z.string().regex(/^\d{1,3}\.\d{4}$/, "Usa una tasa con cuatro decimales, por ejemplo 19.0000."),
}).superRefine((line, context) => {
  if (!line.productId && !line.name) context.addIssue({ code: "custom", path: ["name"], message: "Indica el nombre de la línea personalizada." });
  if (!line.productId && !line.description) context.addIssue({ code: "custom", path: ["description"], message: "Indica la descripción de la línea personalizada." });
  if (!line.productId && (line.description?.length ?? 0) > 5_000) context.addIssue({ code: "custom", path: ["description"], message: "Usa como máximo 5000 caracteres." });
  if (line.productId && !z.uuid().safeParse(line.productId).success) context.addIssue({ code: "custom", path: ["productId"], message: "Selecciona un producto de los resultados." });
});
const formSchema = z.object({
  customerId: z.string().refine((value) => z.uuid().safeParse(value).success, "Selecciona un cliente de los resultados."),
  shippingTotal: money, lines: z.array(lineSchema).min(1, "Agrega al menos una línea.").max(100),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;
const emptyLine = () => ({ productId: "", name: "", description: "", quantity: 1, unitPrice: "", taxRate: "0.0000" });
const inputClass = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200 aria-invalid:border-red-700";
const lineFields = [
  { name: "name", label: "Nombre" }, { name: "description", label: "Descripción" },
  { name: "quantity", label: "Cantidad" }, { name: "unitPrice", label: "Precio unitario (USD)" }, { name: "taxRate", label: "Impuesto" },
] as const;
function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <p className="m-0 text-sm font-semibold text-red-700" role="alert">{message}</p> : null;
}

export function ManualInvoiceForm({ accountId, accessToken, isPending, onCancel, onSubmit }: Readonly<{
  accountId: string; accessToken: string; isPending: boolean;
  onCancel: () => void; onSubmit: (input: CreateManualInvoiceRequest) => void;
}>) {
  const { control, formState, handleSubmit, register, setValue } = useForm<FormInput, unknown, FormValues>({
    defaultValues: { customerId: "", shippingTotal: "0.00", lines: [emptyLine()] }, resolver: zodResolver(formSchema),
  });
  const { append, fields, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  return <form className="grid gap-5" noValidate onSubmit={handleSubmit((values) => {
    const parsed = createManualInvoiceRequestSchema.safeParse({
      customerId: values.customerId, shippingTotal: values.shippingTotal,
      lines: values.lines.map((line) => ({ productId: line.productId || null,
        ...(!line.productId ? { name: line.name, description: line.description } : {}),
        quantity: line.quantity, unitPrice: line.unitPrice, taxRate: line.taxRate })),
    });
    if (parsed.success && !isPending) onSubmit(parsed.data);
  })}>
    <Controller control={control} name="customerId" render={({ field, fieldState }) => (
      <InvoiceEntitySelector label="Cliente" value={field.value} scope={["invoice-customers", accountId]}
        loadOptions={(search, signal) => searchInvoiceCustomers(accessToken, search, signal)}
        optionLabel={(customer) => customer.displayName} optionDescription={(customer) => customer.email}
        onSelect={(customer) => field.onChange(customer.id)} onClear={() => field.onChange("")}
        error={fieldState.error?.message} inputRef={field.ref} onBlur={field.onBlur} disabled={isPending} />
    )} />
    <div className="grid max-w-xs gap-2"><label className="text-sm font-semibold" htmlFor="invoice-shipping">Envío (USD)</label><input disabled={isPending} aria-invalid={!!formState.errors.shippingTotal} className={inputClass} id="invoice-shipping" inputMode="decimal" {...register("shippingTotal")} /><FieldError message={formState.errors.shippingTotal?.message} /></div>
    <fieldset disabled={isPending} className="grid gap-4"><legend className="text-lg font-bold">Líneas de factura</legend>
      {fields.map((field, index) => {
        const errors = formState.errors.lines?.[index];
        const hasProduct = !!lines[index]?.productId;
        return <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4" key={field.id}>
          <div className="flex items-center justify-between gap-3"><h3 className="m-0 text-sm font-bold">Línea {index + 1}</h3>{fields.length > 1 ? <IconButton disabled={isPending} className="border-red-300 text-red-800 hover:bg-red-50" icon="trash" label={`Quitar línea ${index + 1}`} onClick={() => remove(index)} /> : null}</div>
          <Controller control={control} name={`lines.${index}.productId`} render={({ field: productField, fieldState }) => (
            <InvoiceEntitySelector label="Producto (opcional)" value={productField.value} scope={["invoice-products", accountId]}
              loadOptions={(search, signal) => searchInvoiceProducts(accessToken, search, signal)}
              optionLabel={(product) => product.name} optionDescription={(product) => `${product.sku} · USD ${product.price}`}
              error={fieldState.error?.message} inputRef={productField.ref} onBlur={productField.onBlur} disabled={isPending}
              onSelect={(product) => {
                productField.onChange(product.id);
                setValue(`lines.${index}.name`, product.name, { shouldValidate: true });
                setValue(`lines.${index}.description`, product.description, { shouldValidate: true });
                const [whole, decimals = ""] = product.price.split(".");
                setValue(`lines.${index}.unitPrice`, `${whole}.${decimals.padEnd(2, "0")}`, { shouldValidate: true });
              }} onClear={() => {
                productField.onChange("");
                setValue(`lines.${index}.name`, ""); setValue(`lines.${index}.description`, ""); setValue(`lines.${index}.unitPrice`, "");
              }} />
          )} />
          <p className="m-0 text-xs text-slate-500">Selecciona un producto o completa nombre y descripción para una línea manual.</p>
          <div className="grid gap-3 md:grid-cols-2">{lineFields.map(({ name, label }) => {
            const id = `invoice-line-${index}-${name}`;
            const error = errors?.[name]?.message;
            const readOnly = hasProduct && (name === "name" || name === "description");
            return <div className="grid gap-1" key={name}>
              <label className="text-sm font-semibold" htmlFor={id}>{label}</label>
              {name === "description" ? <textarea readOnly={readOnly} aria-invalid={!!error} className={`${inputClass} min-h-20 resize-y`} id={id} {...register(`lines.${index}.${name}`)} />
                : <input readOnly={readOnly} aria-invalid={!!error} className={inputClass} id={id} type={name === "quantity" ? "number" : "text"} min={name === "quantity" ? 1 : undefined} inputMode={name === "unitPrice" || name === "taxRate" ? "decimal" : undefined} {...register(`lines.${index}.${name}`)} />}
              <FieldError message={error} />
            </div>;
          })}</div>
        </div>;
      })}
    </fieldset>
    {typeof formState.errors.lines?.message === "string" ? <FieldError message={formState.errors.lines.message} /> : null}
    <IconButton disabled={isPending || fields.length >= 100} className="border-blue-300 text-blue-800 hover:bg-blue-50" icon="plus" label="+ Agregar línea" onClick={() => append(emptyLine())} />
    <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5"><IconButton className="border-slate-300 text-slate-800 hover:bg-slate-100" disabled={isPending} icon="x" label="Cancelar" onClick={onCancel} /><IconButton className="border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800" disabled={isPending} icon="file-invoice" label={isPending ? "Creando…" : "Crear factura manual"} type="submit" /></div>
  </form>;
}
