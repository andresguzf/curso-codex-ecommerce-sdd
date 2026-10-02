"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProductRequest,
  ProductImageReference,
  ProductListItem,
  UpdateProductRequest,
} from "@technology-ecommerce/api-schemas";
import {
  ConfirmationDialog,
  DataTable,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  useFlashStore,
  type DataTableColumn,
} from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BackofficePagination } from "../../components/backoffice-pagination";
import { BackofficeListLayout, BackofficeListSearch } from "../../components/backoffice-list-layout";
import { useSessionStore } from "../auth/session";
import {
  createProduct,
  deleteProduct,
  listAdministrativeProducts,
  updateProduct,
  updateProductStatus,
  ProductApiError,
} from "./product-api";
import { ProductForm } from "./product-form";
import { ProductGalleryPanel } from "./product-gallery-panel";
import { parseProductAdminFilters, productAdminFiltersToParams, type ProductAdminFilters } from "./product-query";
import { listAllAdministrativeClassifications } from "../classifications/classification-api";

const productQueryKey = ["backoffice", "products"] as const;

type FormState = Readonly<{ mode: "create" }> | Readonly<{ mode: "edit"; product: ProductListItem; created?: true }>;
type ConfirmationState = Readonly<{
  action: "deactivate" | "delete";
  product: ProductListItem;
}>;

function formatMoney(price: string) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(Number(price));
}

export function ProductManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseProductAdminFilters(new URLSearchParams(searchParams.toString()));
  const queryClient = useQueryClient();
  const { session, status } = useSessionStore();
  const [confirmation, setConfirmation] = useState<ConfirmationState>();
  const [form, setForm] = useState<FormState>();
  const [formInstance, setFormInstance] = useState(0);
  const [galleryPending, setGalleryPending] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showFlash = useFlashStore((state) => state.showFlash);
  const accessToken = session?.accessToken ?? "";
  const isAdmin = session?.user.role === "ADMIN";

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [router, status]);

  const productsQuery = useQuery({
    enabled: isAdmin,
    queryFn: ({ signal }) => listAdministrativeProducts(accessToken, filters, signal),
    queryKey: [...productQueryKey, filters],
  });
  const categoriesQuery = useQuery({
    enabled: isAdmin,
    queryFn: ({ signal }) => listAllAdministrativeClassifications("categories", accessToken, signal),
    queryKey: ["classifications", "administrative", "categories", session?.user.id],
  });
  const tagsQuery = useQuery({
    enabled: isAdmin,
    queryFn: ({ signal }) => listAllAdministrativeClassifications("tags", accessToken, signal),
    queryKey: ["classifications", "administrative", "tags", session?.user.id],
  });

  function navigate(updates: Partial<ProductAdminFilters>) {
    const params = productAdminFiltersToParams({ ...filters, ...updates });
    router.push(`/products?${params.toString()}`, { scroll: false });
  }

  function applyFilters(formData: FormData) {
    const minPrice = String(formData.get("minPrice") ?? "").trim();
    const maxPrice = String(formData.get("maxPrice") ?? "").trim();
    const createdFrom = String(formData.get("createdFrom") ?? "").trim();
    const createdTo = String(formData.get("createdTo") ?? "").trim();
    const tagIds = formData.getAll("tagIds").map(String).filter(Boolean);
    if (minPrice && maxPrice && compareMoney(minPrice, maxPrice) > 0) {
      showFlash("error", "El precio mínimo no puede ser mayor que el máximo.");
      return;
    }
    if (createdFrom && createdTo && createdFrom > createdTo) {
      showFlash("error", "La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    navigate({
      page: 1,
      pageSize: Number(formData.get("pageSize") ?? 10),
      status: (String(formData.get("status") ?? "") || undefined) as ProductAdminFilters["status"],
      availability: (String(formData.get("availability") ?? "") || undefined) as ProductAdminFilters["availability"],
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      categoryId: (String(formData.get("categoryId") ?? "") || undefined),
      tagIds: tagIds.length ? tagIds : undefined,
      createdFrom: createdFrom || undefined,
      createdTo: createdTo || undefined,
      sortBy: String(formData.get("sortBy") ?? "createdAt") as ProductAdminFilters["sortBy"],
      sortOrder: String(formData.get("sortOrder") ?? "desc") as ProductAdminFilters["sortOrder"],
    });
    setFiltersOpen(false);
  }

  function compareMoney(left: string, right: string): number {
    const toCents = (value: string) => {
      const [whole, fraction = ""] = value.split(".");
      return BigInt(whole || "0") * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
    };
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(left) || !/^\d{1,10}(?:\.\d{1,2})?$/.test(right)) return 0;
    return toCents(left) < toCents(right) ? -1 : toCents(left) > toCents(right) ? 1 : 0;
  }

  const saveMutation = useMutation({
    mutationFn: async (input: CreateProductRequest & { image: ProductImageReference; isFeatured?: boolean }) => {
      if (form?.mode === "edit") {
        const tagsChanged = JSON.stringify([...(input.tagIds ?? [])].sort()) !== JSON.stringify([...(form.product.tags?.map((tag) => tag.id) ?? [])].sort());
        const changes: UpdateProductRequest = {
          ...(input.categoryId !== (form.product.category?.id ?? null) ? { categoryId: input.categoryId } : {}),
          description: input.description,
          name: input.name,
          price: input.price,
          sku: input.sku,
          ...(Boolean(input.isFeatured) !== Boolean(form.product.isFeatured) ? { isFeatured: Boolean(input.isFeatured) } : {}),
          ...(input.slug && input.slug !== form.product.slug ? { slug: input.slug } : {}),
          ...(tagsChanged || input.tagNames?.length ? { tagIds: input.tagIds ?? [], tagNames: input.tagNames ?? [] } : {}),
        };
        return updateProduct(accessToken, form.product.id, changes);
      }
      return createProduct(accessToken, input);
    },
    onError: (error: Error) => showFlash("error", error instanceof ProductApiError ? error.message : "No pudimos guardar el producto. Inténtalo nuevamente."),
    onSuccess: (savedProduct) => {
      const action = form?.mode === "edit" ? "actualizado" : "creado";
      if (form?.mode === "create") {
        // Keep the same form key: RHF retains changes typed while saving.
        // Further saves now update the returned ID instead of creating again.
        setForm({ mode: "edit", created: true, product: { ...savedProduct, stockAvailable: 0, coverImage: null } });
      } else setForm(undefined);
      showFlash("success", `Producto ${action} correctamente.`);
      void queryClient.invalidateQueries({ queryKey: productQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["catalog", "public", "landing"] });
      void queryClient.invalidateQueries({ queryKey: ["classifications", "active-tags"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ product, status: nextStatus }: { product: ProductListItem; status: "ACTIVE" | "INACTIVE" }) =>
      updateProductStatus(accessToken, product.id, { status: nextStatus }),
    onError: (error: Error) => {
      setConfirmation(undefined);
      showFlash("error", error instanceof ProductApiError ? error.message : "No pudimos cambiar el estado del producto. Inténtalo nuevamente.");
    },
    onSuccess: (_product, variables) => {
      setConfirmation(undefined);
      showFlash("success", `Producto ${variables.status === "ACTIVE" ? "activado" : "desactivado"} correctamente.`);
      void queryClient.invalidateQueries({ queryKey: productQueryKey });
    },
  });

  const featuredMutation = useMutation({
    mutationFn: (product: ProductListItem) => updateProduct(accessToken, product.id, { isFeatured: !product.isFeatured }),
    onError: (error: Error) => showFlash("error", error instanceof ProductApiError ? error.message : "No pudimos actualizar el destaque. Inténtalo nuevamente."),
    onSuccess: (_product, original) => {
      showFlash("success", original.isFeatured ? "Destaque retirado correctamente." : "Producto destacado correctamente.");
      void queryClient.invalidateQueries({ queryKey: productQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["catalog", "public", "landing"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (product: ProductListItem) => deleteProduct(accessToken, product.id),
    onError: (error: Error) => {
      setConfirmation(undefined);
      showFlash("error", error instanceof ProductApiError ? error.message : "No pudimos eliminar el producto. Inténtalo nuevamente.");
    },
    onSuccess: () => {
      setConfirmation(undefined);
      showFlash("success", "Producto eliminado lógicamente.");
      void queryClient.invalidateQueries({ queryKey: productQueryKey });
    },
  });

  function activate(product: ProductListItem) {
    statusMutation.mutate({ product, status: "ACTIVE" });
  }

  const columns: readonly DataTableColumn<ProductListItem>[] = [
    {
      cell: (product) => (
        <div>
          <p className="m-0 font-bold text-slate-950">{product.name}</p>
          <p className="m-0 mt-1 font-mono text-xs text-slate-500">{product.sku}</p>
          {product.isFeatured ? <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-[var(--ds-border)] bg-[var(--ds-accent-soft)] px-2 py-1 text-xs font-bold text-[var(--ds-text)]"><span className="text-[var(--ds-featured)] [&_svg]:fill-current"><Icon name="star" /></span>Destacado</span> : <span className="mt-2 block text-xs text-[var(--ds-text-muted)]">No destacado</span>}
        </div>
      ),
      header: "Producto",
      id: "product",
    },
    { cell: (product) => formatMoney(product.price), header: "Precio (USD)", id: "price" },
    { cell: (product) => product.stockAvailable, header: "Stock", id: "stock" },
    {
      cell: (product) => (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${product.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>
          {product.status === "ACTIVE" ? "Activo" : "Inactivo"}
        </span>
      ),
      header: "Estado",
      id: "status",
    },
    {
      cell: (product) => (
        <div className="flex min-w-64 flex-wrap gap-2">
          <IconButton className={`border-[var(--ds-border)] hover:bg-[var(--ds-accent-soft)] ${product.isFeatured ? "text-[var(--ds-featured)] [&_svg]:fill-current" : "text-[var(--ds-accent)]"}`} disabled={featuredMutation.isPending || saveMutation.isPending || statusMutation.isPending || deleteMutation.isPending || (product.status !== "ACTIVE" && !product.isFeatured)} icon="star" label={product.isFeatured ? "Retirar destaque" : "Destacar"} onClick={() => { if (!featuredMutation.isPending) featuredMutation.mutate(product); }} />
          <IconButton className="border-slate-300 text-slate-700 hover:bg-slate-100" disabled={saveMutation.isPending || galleryPending} icon="edit" label="Editar" onClick={() => { saveMutation.reset(); setForm({ mode: "edit", product }); }} />
          {product.status === "ACTIVE" ? (
            <IconButton className="border-amber-300 text-amber-900 hover:bg-amber-50 focus-visible:ring-amber-700" icon="power" label="Desactivar" onClick={() => setConfirmation({ action: "deactivate", product })} />
          ) : (
            <IconButton className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 focus-visible:ring-emerald-700" icon="power" label="Activar" onClick={() => activate(product)} />
          )}
          <Link aria-label="Inventario" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-300 text-blue-800 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" href={`/products/${product.id}/inventory`} title="Inventario"><Icon name="eye" /></Link>
          <IconButton className="border-red-300 text-red-800 hover:bg-red-50 focus-visible:ring-red-700" icon="trash" label="Eliminar" onClick={() => setConfirmation({ action: "delete", product })} />
        </div>
      ),
      header: "Acciones",
      id: "actions",
    },
  ];

  if (status === "initializing" || (status === "authenticated" && !session)) {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Validando acceso…" /></main>;
  }
  if (status === "anonymous") {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Redirigiendo al acceso…" /></main>;
  }
  if (!isAdmin) {
    return (
      <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6">
        <ErrorState action={<Link className="font-bold underline" href="/">Volver al panel</Link>} message="Tu rol no puede administrar el catálogo." title="Acceso restringido" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-300 pb-6">
          <div>
            <Link className="text-sm font-bold text-blue-800 hover:underline" href="/">← Panel principal</Link>
            <p className="mb-0 mt-5 text-xs font-bold uppercase tracking-[.18em] text-blue-800">Catálogo · Administración</p>
            <h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Productos</h1>
            <p className="mb-0 mt-2 text-slate-600">Gestiona los datos comerciales; el stock se ajusta por separado.</p>
          </div>
          <IconButton className="size-11 rounded-lg border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800 focus-visible:ring-blue-700" disabled={saveMutation.isPending || galleryPending} icon="plus" label="+ Nuevo producto" onClick={() => { saveMutation.reset(); setFormInstance((current) => current + 1); setForm({ mode: "create" }); }} />
        </header>

        {form ? (
          <section aria-labelledby="product-form-title" className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <p className="m-0 text-xs font-bold uppercase tracking-[.16em] text-blue-800">{form.mode === "edit" ? "Edición" : "Alta"}</p>
              <h2 className="mb-0 mt-2 text-2xl font-bold" id="product-form-title">{form.mode === "edit" ? `Editar ${form.product.name}` : "Crear producto"}</h2>
            </div>
            <ProductForm gallery={<ProductGalleryPanel disabled={saveMutation.isPending} onPendingChange={setGalleryPending} productId={form.mode === "edit" ? form.product.id : undefined} />} key={`${formInstance}:${form.mode === "edit" && !form.created ? form.product.id : "create"}`} isGalleryPending={galleryPending} isPending={saveMutation.isPending} onCancel={() => setForm(undefined)} onSubmit={(input) => { if (!saveMutation.isPending && !galleryPending) saveMutation.mutate(input); }} product={form.mode === "edit" ? form.product : undefined} />
          </section>
        ) : null}

        <BackofficeListLayout
          filters={(
            <form className="grid gap-4" key={`filters:${searchParams.toString()}`} onSubmit={(event) => { event.preventDefault(); applyFilters(new FormData(event.currentTarget)); }}>
              <label className="grid gap-1 text-sm font-semibold">Estado<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.status ?? ""} name="status"><option value="">Todos</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Disponibilidad<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.availability ?? ""} name="availability"><option value="">Todos</option><option value="IN_STOCK">Con stock</option><option value="OUT_OF_STOCK">Agotados</option></select></label>
              <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
                <legend className="mb-1 text-sm font-semibold">Rango de precio (USD)</legend>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">Mínimo<input className="min-h-11 min-w-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-950" defaultValue={filters.minPrice ?? ""} inputMode="decimal" min="0" name="minPrice" placeholder="0.00" step="0.01" type="number" /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">Máximo<input className="min-h-11 min-w-0 rounded-lg border border-slate-300 px-3 text-sm text-slate-950" defaultValue={filters.maxPrice ?? ""} inputMode="decimal" min="0" name="maxPrice" placeholder="Sin límite" step="0.01" type="number" /></label>
              </fieldset>
              <label className="grid gap-1 text-sm font-semibold">Categoría<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.categoryId ?? ""} name="categoryId"><option value="">Todas las categorías</option>{(categoriesQuery.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}{category.status === "INACTIVE" ? " (inactiva)" : ""}</option>)}</select></label>
              <fieldset className="grid gap-2 border-0 p-0">
                <legend className="mb-1 text-sm font-semibold">Etiquetas</legend>
                <div aria-label="Etiquetas disponibles" className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                  {(tagsQuery.data ?? []).length ? (tagsQuery.data ?? []).map((tag) => <label className="flex items-center gap-2 text-sm" key={tag.id}><input className="size-4 accent-blue-800" defaultChecked={filters.tagIds?.includes(tag.id) ?? false} name="tagIds" type="checkbox" value={tag.id} /><span>{tag.name}{tag.status === "INACTIVE" ? " (inactiva)" : ""}</span></label>) : <p className="m-0 text-sm text-slate-500">No hay etiquetas disponibles.</p>}
                </div>
                <p className="m-0 text-xs text-slate-500">Puedes combinar varias etiquetas.</p>
              </fieldset>
              <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
                <legend className="mb-1 text-sm font-semibold">Fecha de creación</legend>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">Desde<input className="min-h-11 min-w-0 rounded-lg border border-slate-300 px-2 text-sm text-slate-950" defaultValue={filters.createdFrom ?? ""} max={filters.createdTo} name="createdFrom" type="date" /></label>
                <label className="grid gap-1 text-xs font-semibold text-slate-600">Hasta<input className="min-h-11 min-w-0 rounded-lg border border-slate-300 px-2 text-sm text-slate-950" defaultValue={filters.createdTo ?? ""} min={filters.createdFrom} name="createdTo" type="date" /></label>
              </fieldset>
              <label className="grid gap-1 text-sm font-semibold">Productos por página<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.pageSize} name="pageSize"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Ordenar por<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortBy} name="sortBy"><option value="createdAt">Fecha de alta</option><option value="updatedAt">Actualización</option><option value="name">Nombre</option><option value="sku">SKU</option><option value="price">Precio</option><option value="stockAvailable">Disponibilidad</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Dirección<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortOrder} name="sortOrder"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label>
              <button className="min-h-11 rounded-lg bg-[#15345b] px-4 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2" type="submit">Aplicar filtros</button>
              <button className="min-h-10 font-bold text-blue-800 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" onClick={() => { navigate({ page: 1, pageSize: 10, status: undefined, availability: undefined, minPrice: undefined, maxPrice: undefined, categoryId: undefined, tagIds: undefined, createdFrom: undefined, createdTo: undefined, sortBy: "createdAt", sortOrder: "desc" }); setFiltersOpen(false); }} type="button">Restablecer filtros</button>
            </form>
          )}
          filtersOpen={filtersOpen}
          filtersTitle="Filtros de productos"
          onFiltersOpenChange={setFiltersOpen}
          search={<BackofficeListSearch label="Buscar productos" onClear={() => navigate({ page: 1, search: undefined })} onSearch={(search) => navigate({ page: 1, search: search || undefined })} placeholder="Nombre o SKU" value={filters.search} />}
        >
          <section aria-labelledby="product-list-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-bold" id="product-list-title">Listado administrativo</h2>
              <p className="m-0 text-sm text-slate-600">{productsQuery.data ? `${productsQuery.data.totalItems} productos` : "Consultando productos"}</p>
            </div>
            {productsQuery.isPending ? <LoadingState message="Cargando productos…" /> : productsQuery.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => { void productsQuery.refetch(); }} type="button">Reintentar</button>} message="Revisa la conexión con el API e inténtalo nuevamente." /> : productsQuery.data ? <><DataTable caption="Productos del catálogo" columns={columns} emptyMessage="No hay productos que coincidan con los criterios." rowKey={(product) => product.id} rows={productsQuery.data.items} />{productsQuery.data.totalPages > 0 && filters.page <= productsQuery.data.totalPages ? <div className="mt-5"><BackofficePagination page={productsQuery.data.page} totalPages={productsQuery.data.totalPages} /></div> : filters.page > 1 ? <button className="mt-5 font-bold text-blue-700 underline" onClick={() => navigate({ page: 1 })} type="button">Volver a la primera página</button> : null}</> : null}
          </section>
        </BackofficeListLayout>
      </div>

      <ConfirmationDialog
        confirmLabel={confirmation?.action === "delete" ? "Eliminar producto" : "Desactivar producto"}
        description={confirmation ? `${confirmation.action === "delete" ? "Se eliminará lógicamente" : "Se desactivará"} “${confirmation.product.name}”. Su historial se conservará.` : ""}
        isPending={deleteMutation.isPending || statusMutation.isPending}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={() => {
          if (!confirmation) return;
          if (confirmation.action === "delete") deleteMutation.mutate(confirmation.product);
          else statusMutation.mutate({ product: confirmation.product, status: "INACTIVE" });
        }}
        open={Boolean(confirmation)}
        title={confirmation?.action === "delete" ? "¿Eliminar este producto?" : "¿Desactivar este producto?"}
      />
    </main>
  );
}
