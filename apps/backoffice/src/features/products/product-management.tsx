"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProductRequest,
  ProductListItem,
  UpdateProductRequest,
} from "@technology-ecommerce/api-schemas";
import {
  ConfirmationDialog,
  DataTable,
  ErrorState,
  LoadingState,
  type DataTableColumn,
} from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { BackofficePagination } from "../../components/backoffice-pagination";
import { useSessionStore } from "../auth/session";
import {
  createProduct,
  deleteProduct,
  listAdministrativeProducts,
  updateProduct,
  updateProductStatus,
} from "./product-api";
import { ProductForm } from "./product-form";

const pageSchema = z.coerce.number().int().min(1).catch(1);
const productQueryKey = ["backoffice", "products"] as const;

type FormState = Readonly<{ mode: "create" }> | Readonly<{ mode: "edit"; product: ProductListItem }>;
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
  const queryClient = useQueryClient();
  const { session, status } = useSessionStore();
  const [confirmation, setConfirmation] = useState<ConfirmationState>();
  const [form, setForm] = useState<FormState>();
  const [notice, setNotice] = useState<string>();
  const page = pageSchema.parse(searchParams.get("page") ?? "1");
  const accessToken = session?.accessToken ?? "";
  const isAdmin = session?.user.role === "ADMIN";

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [router, status]);

  const productsQuery = useQuery({
    enabled: isAdmin,
    queryFn: () => listAdministrativeProducts(accessToken, page),
    queryKey: [...productQueryKey, { page }],
  });

  const saveMutation = useMutation({
    mutationFn: async (input: CreateProductRequest) => {
      if (form?.mode === "edit") {
        const changes: UpdateProductRequest = {
          description: input.description,
          image: input.image,
          name: input.name,
          price: input.price,
          sku: input.sku,
        };
        return updateProduct(accessToken, form.product.id, changes);
      }
      return createProduct(accessToken, input);
    },
    onError: (error: Error) => setNotice(error.message),
    onSuccess: async () => {
      const action = form?.mode === "edit" ? "actualizado" : "creado";
      await queryClient.invalidateQueries({ queryKey: productQueryKey });
      setForm(undefined);
      setNotice(`Producto ${action} correctamente.`);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ product, status: nextStatus }: { product: ProductListItem; status: "ACTIVE" | "INACTIVE" }) =>
      updateProductStatus(accessToken, product.id, { status: nextStatus }),
    onError: (error: Error) => setNotice(error.message),
    onSuccess: async (_product, variables) => {
      await queryClient.invalidateQueries({ queryKey: productQueryKey });
      setConfirmation(undefined);
      setNotice(`Producto ${variables.status === "ACTIVE" ? "activado" : "desactivado"} correctamente.`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (product: ProductListItem) => deleteProduct(accessToken, product.id),
    onError: (error: Error) => setNotice(error.message),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productQueryKey });
      setConfirmation(undefined);
      setNotice("Producto eliminado lógicamente.");
    },
  });

  function activate(product: ProductListItem) {
    setNotice(undefined);
    statusMutation.mutate({ product, status: "ACTIVE" });
  }

  const columns: readonly DataTableColumn<ProductListItem>[] = [
    {
      cell: (product) => (
        <div>
          <p className="m-0 font-bold text-slate-950">{product.name}</p>
          <p className="m-0 mt-1 font-mono text-xs text-slate-500">{product.sku}</p>
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
          <button className="rounded-md border border-slate-300 px-3 py-2 font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" onClick={() => { saveMutation.reset(); setNotice(undefined); setForm({ mode: "edit", product }); }} type="button">Editar</button>
          {product.status === "ACTIVE" ? (
            <button className="rounded-md border border-amber-300 px-3 py-2 font-semibold text-amber-900 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700" onClick={() => setConfirmation({ action: "deactivate", product })} type="button">Desactivar</button>
          ) : (
            <button className="rounded-md border border-emerald-300 px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" onClick={() => activate(product)} type="button">Activar</button>
          )}
          <Link className="rounded-md border border-blue-300 px-3 py-2 font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" href={`/products/${product.id}/inventory`}>Inventario</Link>
          <button className="rounded-md border border-red-300 px-3 py-2 font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" onClick={() => setConfirmation({ action: "delete", product })} type="button">Eliminar</button>
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
          <button className="min-h-11 rounded-lg bg-[#15345b] px-5 py-3 font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700" onClick={() => { saveMutation.reset(); setNotice(undefined); setForm({ mode: "create" }); }} type="button">+ Nuevo producto</button>
        </header>

        <div aria-atomic="true" aria-live="polite" className={`min-h-12 py-3 text-sm font-semibold ${notice?.includes("correctamente") || notice?.includes("lógicamente") ? "text-emerald-800" : "text-red-800"}`}>{notice}</div>

        {form ? (
          <section aria-labelledby="product-form-title" className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <p className="m-0 text-xs font-bold uppercase tracking-[.16em] text-blue-800">{form.mode === "edit" ? "Edición" : "Alta"}</p>
              <h2 className="mb-0 mt-2 text-2xl font-bold" id="product-form-title">{form.mode === "edit" ? `Editar ${form.product.name}` : "Crear producto"}</h2>
            </div>
            <ProductForm key={form.mode === "edit" ? form.product.id : "create"} isPending={saveMutation.isPending} onCancel={() => setForm(undefined)} onSubmit={(input) => saveMutation.mutate(input)} product={form.mode === "edit" ? form.product : undefined} />
          </section>
        ) : null}

        {productsQuery.isPending ? <LoadingState message="Cargando productos…" /> : null}
        {productsQuery.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => productsQuery.refetch()} type="button">Reintentar</button>} message="Revisa la conexión con el API e inténtalo nuevamente." /> : null}
        {productsQuery.data ? (
          <section aria-labelledby="product-list-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-lg font-bold" id="product-list-title">Listado administrativo</h2>
              <p className="m-0 text-sm text-slate-600">{productsQuery.data.totalItems} productos</p>
            </div>
            <DataTable caption="Productos del catálogo" columns={columns} emptyMessage="Todavía no hay productos en el catálogo." rowKey={(product) => product.id} rows={productsQuery.data.items} />
            {productsQuery.data.totalPages > 0 ? <div className="mt-5"><BackofficePagination page={productsQuery.data.page} totalPages={productsQuery.data.totalPages} /></div> : null}
          </section>
        ) : null}
      </div>

      <ConfirmationDialog
        confirmLabel={confirmation?.action === "delete" ? "Eliminar producto" : "Desactivar producto"}
        description={confirmation ? `${confirmation.action === "delete" ? "Se eliminará lógicamente" : "Se desactivará"} “${confirmation.product.name}”. Su historial se conservará.` : ""}
        isPending={deleteMutation.isPending || statusMutation.isPending}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={() => {
          if (!confirmation) return;
          setNotice(undefined);
          if (confirmation.action === "delete") deleteMutation.mutate(confirmation.product);
          else statusMutation.mutate({ product: confirmation.product, status: "INACTIVE" });
        }}
        open={Boolean(confirmation)}
        title={confirmation?.action === "delete" ? "¿Eliminar este producto?" : "¿Desactivar este producto?"}
      />
    </main>
  );
}
