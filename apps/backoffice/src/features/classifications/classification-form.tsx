"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { categoryFormSchema, type CategoryFormValues, type Category, type Tag } from "@technology-ecommerce/api-schemas";
import { IconButton, TextField } from "@technology-ecommerce/ui";
import { useForm } from "react-hook-form";

import type { ClassificationInput, ClassificationKind } from "./classification-api";

export function ClassificationForm({ kind, record, isPending, onCancel, onSubmit }: Readonly<{
  kind: ClassificationKind;
  record?: Category | Tag;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: ClassificationInput) => void;
}>) {
  const schema = categoryFormSchema.superRefine((value, context) => {
    if (kind === "tags" && value.name.length > 120) context.addIssue({ code: "custom", message: "Máximo 120 caracteres.", path: ["name"] });
    if (kind === "tags" && value.slug.length > 140) context.addIssue({ code: "custom", message: "Máximo 140 caracteres.", path: ["slug"] });
  });
  const { formState, handleSubmit, register } = useForm<CategoryFormValues>({
    defaultValues: {
      name: record?.name ?? "",
      slug: record?.slug ?? "",
      description: record && "description" in record ? record.description : "",
    },
    resolver: zodResolver(schema),
  });

  function submit(values: CategoryFormValues) {
    onSubmit({
      name: values.name,
      ...(values.slug ? { slug: values.slug } : {}),
      ...(kind === "categories" ? { description: values.description } : {}),
    });
  }

  const singular = kind === "categories" ? "categoría" : "etiqueta";
  return (
    <form className="grid gap-5" noValidate onSubmit={handleSubmit(submit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField error={formState.errors.name?.message} id={`${kind}-name`} label="Nombre" maxLength={kind === "tags" ? 120 : 200} {...register("name")} />
        <TextField error={formState.errors.slug?.message} hint={record ? "Cambiar el slug puede romper enlaces existentes." : "Opcional. Se genera a partir del nombre si lo dejas vacío."} id={`${kind}-slug`} label="Slug" maxLength={kind === "tags" ? 140 : 220} {...register("slug")} />
      </div>
      {kind === "categories" ? (
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-800" htmlFor="category-description">Descripción</label>
          <textarea aria-describedby={formState.errors.description ? "category-description-error" : undefined} className="min-h-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" id="category-description" maxLength={10_000} {...register("description")} />
          {formState.errors.description ? <p className="m-0 text-sm text-red-700" id="category-description-error" role="alert">{formState.errors.description.message}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
        <IconButton className="border-slate-300 text-slate-800 hover:bg-slate-100" disabled={isPending} icon="x" label="Cancelar" onClick={onCancel} />
        <IconButton className="border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800" disabled={isPending} icon="check" label={isPending ? "Guardando…" : record ? `Guardar ${singular}` : `Crear ${singular}`} type="submit" />
      </div>
    </form>
  );
}
