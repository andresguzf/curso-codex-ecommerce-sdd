"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductRequestSchema,
  type CreateProductRequest,
  type ProductListItem,
} from "@technology-ecommerce/api-schemas";
import { TextField } from "@technology-ecommerce/ui";
import { useForm } from "react-hook-form";
import { z } from "zod";

const DEFAULT_PRODUCT_IMAGE_URL = "/images/product-placeholder.svg";

const productFormSchema = createProductRequestSchema.extend({
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
): NonNullable<CreateProductRequest["image"]> {
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
  onSubmit: (input: CreateProductRequest) => void;
  product?: ProductListItem;
}>) {
  const { formState, handleSubmit, register } = useForm<ProductFormValues>({
    defaultValues: product
      ? {
          description: product.description,
          image: product.image,
          name: product.name,
          price: product.price,
          sku: product.sku,
          status: product.status,
        }
      : {
          description: "",
          image: { storageKey: "", url: "" },
          name: "",
          price: "",
          sku: "",
          status: "INACTIVE",
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
        <button
          className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          disabled={isPending}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="min-h-11 rounded-lg bg-[#15345b] px-5 py-2 font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
