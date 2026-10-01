"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { getActiveCategories, getActiveTags } from "@technology-ecommerce/api-client";
import {
  createProductRequestSchema,
  type CreateProductRequest,
  type ProductImageReference,
  type ProductListItem,
  type Tag,
} from "@technology-ecommerce/api-schemas";
import { IconButton, TextField } from "@technology-ecommerce/ui";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ProductTagEditor } from "./product-tag-editor";

const DEFAULT_PRODUCT_IMAGE_URL = "/images/product-placeholder.svg";

const productFormSchema = createProductRequestSchema.extend({
  isFeatured: z.boolean().optional(),
  categoryId: z.union([z.uuid(), z.literal("")]).optional(),
  slug: z.string().trim().max(220).optional(),
  image: z
    .object({
      storageKey: z.string().trim().max(512).optional(),
      url: z.string().trim().max(2_048).optional(),
    })
    .optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

function mergeTags(
  selectedIds: readonly string[],
  selectedNames: readonly string[],
  draft: string,
  knownTags: readonly Pick<Tag, "id" | "name" | "status">[],
): { tagIds: string[]; tagNames: string[]; error?: string } {
  const ids = new Set(selectedIds);
  const names = new Map(selectedNames.map((name) => [name.trim().toUpperCase(), name.trim()]));
  for (const rawName of draft.split(",")) {
    const name = rawName.trim();
    if (!name) continue;
    if (name.length > 120) return { tagIds: [...ids], tagNames: [...names.values()], error: "Cada etiqueta debe tener como máximo 120 caracteres." };
    const key = name.toUpperCase();
    const existing = knownTags.find((tag) => tag.name.toUpperCase() === key);
    if (existing?.status === "INACTIVE") return { tagIds: [...ids], tagNames: [...names.values()], error: `La etiqueta «${existing.name}» está inactiva.` };
    if (existing) ids.add(existing.id);
    else names.set(key, name);
  }
  if (ids.size + names.size > 20) return { tagIds: [...ids], tagNames: [...names.values()], error: "Selecciona como máximo 20 etiquetas distintas." };
  return { tagIds: [...ids], tagNames: [...names.values()] };
}

function defaultImageStorageKey(sku: string): string {
  const segment = sku
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `defaults/products/${segment || "product"}/placeholder.svg`;
}

function normalizeImage(
  image: ProductFormValues["image"],
  sku: string,
): ProductImageReference {
  return {
    storageKey: image?.storageKey?.trim() || defaultImageStorageKey(sku),
    url: image?.url?.trim() || DEFAULT_PRODUCT_IMAGE_URL,
  };
}

export function ProductForm({
  isPending,
  onCancel,
  onSubmit,
  product,
}: Readonly<{
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateProductRequest & { image: ProductImageReference; isFeatured?: boolean }) => void;
  product?: ProductListItem;
}>) {
  const [tagDraft, setTagDraft] = useState("");
  const categoriesQuery = useQuery({ queryKey: ["classifications", "active-categories"], queryFn: ({ signal }) => getActiveCategories(signal) });
  const tagsQuery = useQuery({ queryKey: ["classifications", "active-tags"], queryFn: ({ signal }) => getActiveTags(signal) });
  const { clearErrors, control, formState, getValues, handleSubmit, register, setError, setValue } = useForm<ProductFormValues>({
    defaultValues: product
      ? {
          description: product.description,
          isFeatured: product.isFeatured ?? false,
          categoryId: product.category?.id ?? "",
          image: product.image,
          name: product.name,
          price: product.price,
          sku: product.sku,
          slug: product.slug ?? "",
          status: product.status,
          tagIds: product.tags?.map((tag) => tag.id) ?? [],
          tagNames: [],
        }
      : {
          description: "",
          isFeatured: false,
          categoryId: "",
          image: { storageKey: "", url: "" },
          name: "",
          price: "",
          sku: "",
          slug: "",
          status: "INACTIVE",
          tagIds: [],
          tagNames: [],
        },
    resolver: zodResolver(productFormSchema),
  });

  const inputClass =
    "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200 aria-invalid:border-red-700";
  const selectedTagIds = useWatch({ control, name: "tagIds" }) ?? [];
  const newTagNames = useWatch({ control, name: "tagNames" }) ?? [];
  const isFeatured = useWatch({ control, name: "isFeatured" }) ?? false;
  const knownTags = [...(tagsQuery.data ?? []), ...(product?.tags ?? [])];

  function updateTags(draft: string): { tagIds: string[]; tagNames: string[] } | undefined {
    const merged = mergeTags(getValues("tagIds") ?? [], getValues("tagNames") ?? [], draft, knownTags);
    if (merged.error) {
      setError("tagNames", { message: merged.error });
      return undefined;
    }
    setValue("tagIds", merged.tagIds, { shouldValidate: true });
    setValue("tagNames", merged.tagNames, { shouldValidate: true });
    clearErrors("tagNames");
    return merged;
  }

  function commitTags(value: string) {
    if (!updateTags(value)) return false;
    setTagDraft("");
    return true;
  }

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={handleSubmit((input) => {
        const merged = mergeTags(input.tagIds ?? [], input.tagNames ?? [], tagDraft, knownTags);
        if (merged.error) { setError("tagNames", { message: merged.error }); return; }
        const { isFeatured: featuredSelection, ...commercialInput } = input;
        const payload = createProductRequestSchema.safeParse({
          ...commercialInput,
          categoryId: input.categoryId || null,
          image: normalizeImage(input.image, input.sku),
          slug: input.slug?.trim() || undefined,
          tagIds: merged.tagIds,
          tagNames: merged.tagNames,
        });
        if (!payload.success) {
          setError("tagNames", { message: "Revisa las etiquetas seleccionadas." });
          return;
        }
        setTagDraft("");
        onSubmit({ ...payload.data, ...(product ? { isFeatured: Boolean(featuredSelection) } : {}), image: normalizeImage(input.image, input.sku) });
      })}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          autoComplete="off"
          error={formState.errors.sku?.message}
          id="product-sku"
          label="SKU"
          {...register("sku")}
        />
        <TextField
          autoComplete="off"
          error={formState.errors.name?.message}
          id="product-name"
          label="Nombre"
          {...register("name")}
        />
      </div>

      <TextField
        autoComplete="off"
        error={formState.errors.slug?.message}
        hint={product ? "Opcional. Déjalo igual para conservar el enlace actual." : "Opcional. Si lo dejas vacío, se genera a partir del nombre."}
        id="product-slug"
        label="Slug del producto"
        placeholder="teclado-mecanico-rgb"
        {...register("slug")}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <label className="text-sm font-semibold text-slate-800" htmlFor="product-category">Categoría principal</label>
          {categoriesQuery.data ? <select className={inputClass} id="product-category" {...register("categoryId")}>
            <option value="">Sin categoría</option>
            {product?.category?.status === "INACTIVE" ? <option disabled value={product.category.id}>{product.category.name} (inactiva)</option> : null}
            {categoriesQuery.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select> : null}
          {categoriesQuery.isPending ? <p className="m-0 text-xs text-slate-600">Cargando categorías…</p> : null}
          {categoriesQuery.isError ? <p className="m-0 text-xs text-red-700" role="alert">No se pudieron cargar las categorías.</p> : null}
          {formState.errors.categoryId ? <p className="m-0 text-xs text-red-700" role="alert">{formState.errors.categoryId.message}</p> : null}
        </div>
        <div className="grid content-start gap-2">
          <ProductTagEditor
            availableTags={tagsQuery.data ?? []}
            currentTags={product?.tags ?? []}
            draft={tagDraft}
            error={formState.errors.tagNames?.message ?? formState.errors.tagIds?.message}
            newNames={newTagNames}
            onCommit={commitTags}
            onDraftChange={setTagDraft}
            onRemoveId={(id) => setValue("tagIds", selectedTagIds.filter((selected) => selected !== id), { shouldValidate: true })}
            onRemoveName={(name) => setValue("tagNames", newTagNames.filter((selected) => selected.toUpperCase() !== name.toUpperCase()), { shouldValidate: true })}
            onSelectId={(id) => updateTags(knownTags.find((tag) => tag.id === id)?.name ?? "")}
            selectedIds={selectedTagIds}
          />
          {tagsQuery.isPending ? <p className="m-0 text-xs text-slate-600">Cargando etiquetas existentes…</p> : null}
          {tagsQuery.isError ? <p className="m-0 text-xs text-red-700" role="alert">No se pudieron cargar las etiquetas existentes. Puedes escribir nuevas etiquetas por nombre.</p> : null}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-slate-800" htmlFor="product-description">
          Descripción
        </label>
        <textarea
          aria-invalid={Boolean(formState.errors.description)}
          className={`${inputClass} min-h-28 resize-y`}
          id="product-description"
          {...register("description")}
        />
        {formState.errors.description ? (
          <p className="m-0 text-sm font-semibold text-red-700" role="alert">
            {formState.errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          error={formState.errors.price?.message}
          id="product-price"
          inputMode="decimal"
          hint="Todos los precios del sistema se expresan en dólares estadounidenses."
          label="Precio (USD)"
          placeholder="1299.90"
          {...register("price")}
        />
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-800" htmlFor="product-status">
            Estado inicial
          </label>
          <select className={inputClass} disabled={Boolean(product)} id="product-status" {...register("status")}>
            <option value="INACTIVE">Inactivo</option>
            <option value="ACTIVE">Activo</option>
          </select>
          {product ? <p className="m-0 text-xs text-slate-500">El estado se cambia desde el listado.</p> : null}
        </div>
      </div>

      {product ? <fieldset className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-subtle)] p-4 text-[var(--ds-text)]">
        <legend className="px-2 text-sm font-bold">Selección editorial</legend>
        <label className="flex min-h-11 items-center gap-3 font-semibold" htmlFor="product-featured">
          <input aria-describedby="product-featured-hint" className="size-5 accent-[var(--ds-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus)]" disabled={isPending || (product.status !== "ACTIVE" && !isFeatured)} id="product-featured" type="checkbox" {...register("isFeatured")} />
          Destacar producto
        </label>
        <p className="mb-0 mt-2 text-sm text-[var(--ds-text-muted)]" id="product-featured-hint">Solo los productos activos pueden destacarse. La fecha la asigna el servidor al destacar; guardar otros cambios no la renueva.</p>
      </fieldset> : null}

      <TextField
        error={formState.errors.image?.url?.message}
        hint="Opcional. Si se deja vacío, se usa una portada genérica. No se valida el formato de la URL."
        id="product-image-url"
        label="URL de imagen"
        type="text"
        {...register("image.url")}
      />
      <TextField
        error={formState.errors.image?.storageKey?.message}
        hint="Opcional. Si se deja vacío, se genera una clave única para la portada genérica."
        id="product-storage-key"
        label="Clave de almacenamiento"
        {...register("image.storageKey")}
      />

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
        <IconButton className="border-slate-300 text-slate-800 hover:bg-slate-100 focus-visible:ring-blue-700" disabled={isPending} icon="x" label="Cancelar" onClick={onCancel} />
        <IconButton className="border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800 focus-visible:ring-blue-700" disabled={isPending || !categoriesQuery.data} icon="check" label={isPending ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"} type="submit" />
      </div>
    </form>
  );
}
