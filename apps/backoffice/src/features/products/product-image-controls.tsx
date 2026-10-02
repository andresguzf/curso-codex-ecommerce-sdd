"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconButton } from "@technology-ecommerce/ui";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({ altText: z.string().trim().min(1, "Describe la imagen.").max(500, "Usa como máximo 500 caracteres.") });

export function ProductImageControls({ altText, disabled, primary, first, last, onUpdate }: Readonly<{
  altText: string; disabled: boolean; primary: boolean; first: boolean; last: boolean;
  onUpdate: (input: { altText?: string; isPrimary?: boolean }) => Promise<boolean>;
}>) {
  const id = useId();
  const editButton = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof schema>>({ defaultValues: { altText }, resolver: zodResolver(schema) });
  function save() {
    return handleSubmit(async (input) => {
      if (!disabled && await onUpdate(input)) setEditing(false);
    })();
  }
  const buttonClass = "border-[var(--ds-border)] text-[var(--ds-accent)] hover:bg-[var(--ds-accent-soft)]";
  return <div className="mt-3 grid gap-3">
    {editing ? <fieldset className="m-0 grid min-w-0 gap-2 border-0 p-0" disabled={disabled || formState.isSubmitting}>
      <label className="text-xs font-semibold" htmlFor={id}>Texto alternativo</label>
      <input {...register("altText")} aria-describedby={`${id}-error`} aria-invalid={Boolean(formState.errors.altText)} className="min-h-11 w-full min-w-0 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-2 text-sm text-[var(--ds-text)] focus-visible:outline-2 focus-visible:outline-[var(--ds-focus)]" id={id} maxLength={500} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); void save(); } }} />
      <p className="m-0 text-xs text-[var(--ds-danger)]" id={`${id}-error`} role={formState.errors.altText ? "alert" : undefined}>{formState.errors.altText?.message}</p>
      <div className="flex gap-2">
        <IconButton className={buttonClass} icon="check" label={`Guardar descripción de ${altText}`} onClick={() => { void save(); }} />
        <IconButton className={buttonClass} icon="x" label={`Cancelar edición de ${altText}`} onClick={() => { reset({ altText }); setEditing(false); requestAnimationFrame(() => editButton.current?.focus()); }} />
      </div>
    </fieldset> : <div className="flex flex-wrap gap-2">
      <IconButton className={buttonClass} disabled={disabled} icon="edit" ref={editButton} label={`Editar descripción de ${altText}`} onClick={() => { setEditing(true); requestAnimationFrame(() => document.getElementById(id)?.focus()); }} />
      <IconButton className={buttonClass} disabled={disabled || primary} icon="star" label={primary ? `${altText} es portada` : `Usar ${altText} como portada`} onClick={() => { void onUpdate({ isPrimary: true }); }} />
    </div>}
    <p className="sr-only">{first ? "Primera imagen. " : ""}{last ? "Última imagen." : ""}</p>
  </div>;
}
