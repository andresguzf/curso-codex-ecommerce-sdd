"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { useProductImageMutations } from "./use-product-image-mutations";

const metadataSchema = z.object({ altText: z.string().trim().min(1, "Describe la imagen antes de subirla.").max(500, "La descripción admite hasta 500 caracteres.") });
const fileMetadataSchema = z.object({ size: z.number().positive(), type: z.enum(["image/jpeg", "image/png", "image/webp"]) });

export function ProductImageUpload({ upload, disabled, full }: Readonly<{
  upload: ReturnType<typeof useProductImageMutations>;
  disabled: boolean;
  full: boolean;
}>) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const previewResource = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const { register, handleSubmit, formState, setError, clearErrors, reset } = useForm<z.infer<typeof metadataSchema>>({
    defaultValues: { altText: "" }, resolver: zodResolver(metadataSchema),
  });
  const busy = disabled || upload.isPending || formState.isSubmitting;
  const controlClass = "min-h-11 w-full min-w-0 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm text-[var(--ds-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)] disabled:opacity-60";
  useEffect(() => () => {
    if (previewResource.current) URL.revokeObjectURL(previewResource.current);
  }, []);

  function clearFile(resetInput = true) {
    if (previewResource.current) URL.revokeObjectURL(previewResource.current);
    previewResource.current = null;
    setPreview(null);
    setFile(null);
    setPreviewFailed(false);
    if (resetInput && fileInput.current) fileInput.current.value = "";
  }
  function selectFile(selected?: File) {
    clearFile(false);
    clearErrors();
    if (!selected) return;
    if (!fileMetadataSchema.safeParse(selected).success) {
      clearFile();
      setError("root.file", { message: "Selecciona un archivo JPEG, PNG o WebP que no esté vacío." });
      return;
    }
    setFile(selected);
    try {
      const url = URL.createObjectURL(selected);
      previewResource.current = url;
      setPreview(url);
    } catch { setPreviewFailed(true); }
  }
  function submitUpload() {
    return handleSubmit(async ({ altText }) => {
      if (busy || full) return;
      if (!file) { setError("root.file", { message: "Selecciona una imagen antes de subirla." }); return; }
      const saved = await upload.upload(file, altText);
      if (saved) { clearFile(); reset({ altText: "" }); }
    })();
  }

  // This fieldset lives inside the commercial form. Do not nest another form
  // or let Enter submit/create the product while uploading an image.
  return <fieldset aria-busy={upload.isPending} className="mt-5 min-w-0 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-subtle)] p-4" disabled={busy || full}>
    <legend className="px-2 text-sm font-bold">Agregar imagen</legend>
    {full ? <p className="mb-3 mt-0 text-sm text-[var(--ds-text-muted)]">Límite alcanzado: cuatro imágenes en total, incluida la portada.</p> : null}
    <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="grid aspect-[4/3] min-w-0 place-items-center overflow-hidden rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)]">
        {preview && !previewFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Vista previa de la imagen seleccionada" className="h-full w-full object-contain" height={600} onError={() => setPreviewFailed(true)} src={preview} width={800} />
        ) : <p className="m-0 px-4 text-center text-sm text-[var(--ds-text-muted)]">{previewFailed ? "Vista previa no disponible" : "Selecciona una imagen para previsualizarla"}</p>}
      </div>
      <div className="grid min-w-0 content-start gap-3">
        <label className="grid min-w-0 gap-2 text-sm font-semibold" htmlFor={`${id}-file`}>Archivo de imagen
          <input accept="image/jpeg,image/png,image/webp" aria-describedby={`${id}-formats ${id}-file-error`} className={`${controlClass} file:mr-3 file:rounded-md file:border-0 file:bg-[var(--ds-accent-soft)] file:px-3 file:py-1 file:text-[var(--ds-text)]`} id={`${id}-file`} onChange={(event) => selectFile(event.currentTarget.files?.[0])} ref={fileInput} type="file" />
        </label>
        <p className="m-0 text-xs text-[var(--ds-text-muted)]" id={`${id}-formats`}>JPEG, PNG o WebP. El tamaño y el contenido se comprueban al subir.</p>
        {file ? <p className="m-0 break-all text-xs text-[var(--ds-text-muted)]">{file.name} · Vista previa sin guardar</p> : null}
        <p className="m-0 text-sm text-[var(--ds-danger)]" id={`${id}-file-error`} role={formState.errors.root?.file ? "alert" : undefined}>{formState.errors.root?.file?.message}</p>
        <label className="grid gap-2 text-sm font-semibold" htmlFor={`${id}-alt`}>Texto alternativo de la nueva imagen
          <input aria-describedby={`${id}-alt-error`} aria-invalid={Boolean(formState.errors.altText)} className={controlClass} id={`${id}-alt`} maxLength={500} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); void submitUpload(); } }} {...register("altText")} />
        </label>
        <p className="m-0 text-sm text-[var(--ds-danger)]" id={`${id}-alt-error`} role={formState.errors.altText ? "alert" : undefined}>{formState.errors.altText?.message}</p>
        <div className="flex flex-wrap gap-3">
          <button className="min-h-11 rounded-lg bg-[var(--ds-accent)] px-4 text-sm font-bold text-[var(--ds-accent-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)] disabled:opacity-60" disabled={busy || full} onClick={() => { void submitUpload(); }} type="button">{upload.isPending ? "Subiendo imagen…" : "Subir imagen"}</button>
          {file ? <button className="min-h-11 rounded-lg border border-[var(--ds-border)] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)]" onClick={() => { clearFile(); clearErrors(); }} type="button">Descartar selección</button> : null}
        </div>
      </div>
    </div>
  </fieldset>;
}
