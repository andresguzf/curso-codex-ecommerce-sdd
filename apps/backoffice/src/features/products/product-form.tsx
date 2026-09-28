"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { getActiveCategories, getActiveTags } from "@technology-ecommerce/api-client";
import {
  createProductRequestSchema,
  type CreateProductRequest,
  type ProductImageReference,
  type ProductListItem,
} from "@technology-ecommerce/api-schemas";
import { IconButton, TextField } from "@technology-ecommerce/ui";
import { useForm } from "react-hook-form";
import { z } from "zod";

const DEFAULT_PRODUCT_IMAGE_URL = "/images/product-placeholder.svg";

const productFormSchema = createProductRequestSchema.extend({
  categoryId: z.union([z.uuid(), z.literal("")]).optional(),
  image: z
    .object({
      storageKey: z.string().trim().max(512).optional(),
      url: z.string().trim().max(2_048).optional(),
    })
    .optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

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
  onSubmit: (input: CreateProductRequest & { image: ProductImageReference }) => void;
  product?: ProductListItem;
}>) {
  const categoriesQuery = useQuery({ queryKey: ["classifications", "active-categories"], queryFn: ({ signal }) => getActiveCategories(signal) });
  const tagsQuery = useQuery({ queryKey: ["classifications", "active-tags"], queryFn: ({ signal }) => getActiveTags(signal) });
  const { formState, handleSubmit, register } = useForm<ProductFormValues>({
    defaultValues: product
      ? {
          description: product.description,
          categoryId: product.category?.id ?? "",
          image: product.image,
          name: product.name,
          price: product.price,
          sku: product.sku,
          status: product.status,
          tagIds: product.tags?.map((tag) => tag.id) ?? [],
        }
      : {
          description: "",
          categoryId: "",
          image: { storageKey: "", url: "" },
          name: "",
          price: "",
          sku: "",
          status: "INACTIVE",
          tagIds: [],
        },
    resolver: zodResolver(productFormSchema),
  });

  const inputClass =
    "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200 aria-invalid:border-red-700";

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={handleSubmit((input) =>
        onSubmit({
          ...input,
          categoryId: input.categoryId || null,
          image: normalizeImage(input.image, input.sku),
        }),
      )}
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid content-start gap-2">
          <label className="text-sm font-semibold text-slate-800" htmlFor="product-category">Categoría principal</label>
          {categoriesQuery.data ? <select className={inputClass} id="product-category" {...register("categoryId")}>
            <option value="">Sin categoría</option>
            {product?.category?.status === "INACTIVE" ? <option value={product.category.id}>{product.category.name} (inactiva)</option> : null}
            {categoriesQuery.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select> : null}
          {categoriesQuery.isPending ? <p className="m-0 text-xs text-slate-600">Cargando categorías…</p> : null}
          {categoriesQuery.isError ? <p className="m-0 text-xs text-red-700" role="alert">No se pudieron cargar las categorías.</p> : null}
          {formState.errors.categoryId ? <p className="m-0 text-xs text-red-700" role="alert">{formState.errors.categoryId.message}</p> : null}
        </div>
        <fieldset className="grid content-start gap-2 rounded-lg border border-slate-300 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-800">Etiquetas</legend>
          {tagsQuery.isPending ? <p className="m-0 text-xs text-slate-600">Cargando etiquetas…</p> : null}
          {tagsQuery.isError ? <p className="m-0 text-xs text-red-700" role="alert">No se pudieron cargar las etiquetas.</p> : null}
          {[...(tagsQuery.data ?? []), ...(product?.tags?.filter((tag) => tag.status === "INACTIVE") ?? [])].map((tag) => (
            <label className="flex min-h-9 items-center gap-2 text-sm text-slate-800" key={tag.id}>
              <input className="size-4 accent-blue-700" type="checkbox" value={tag.id} {...register("tagIds")} />
              {tag.name}{tag.status === "INACTIVE" ? " (inactiva)" : ""}
            </label>
          ))}
          {tagsQuery.data?.length === 0 ? <p className="m-0 text-xs text-slate-600">No hay etiquetas activas.</p> : null}
          {formState.errors.tagIds ? <p className="m-0 text-xs text-red-700" role="alert">Selecciona como máximo 20 etiquetas distintas.</p> : null}
        </fieldset>
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
        <IconButton className="border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800 focus-visible:ring-blue-700" disabled={isPending || !categoriesQuery.data || !tagsQuery.data} icon="check" label={isPending ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"} type="submit" />
      </div>
    </form>
  );
}
