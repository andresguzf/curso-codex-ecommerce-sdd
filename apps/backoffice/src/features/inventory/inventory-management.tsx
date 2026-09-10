"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  inventoryAdjustmentRequestSchema,
  type InventoryAdjustmentRequest,
  type InventoryMovement,
} from "@technology-ecommerce/api-schemas";
import {
  DataTable,
  ErrorState,
  IconButton,
  LoadingState,
  type DataTableColumn,
} from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { BackofficePagination } from "../../components/backoffice-pagination";
import { useSessionStore } from "../auth/session";
import { getAdministrativeProduct } from "../products/product-api";
import { adjustInventory, listInventoryMovements } from "./inventory-api";

const pageSchema = z.coerce.number().int().min(1).catch(1);
const adjustmentFormSchema = z.object({
  direction: z.enum(["ADD", "REMOVE"]),
  quantity: z.number().int().min(1).max(2_147_483_647),
  reason: inventoryAdjustmentRequestSchema.shape.reason,
});
type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

const productKey = (productId: string) => ["backoffice", "product", productId] as const;
const movementKey = (productId: string) => ["backoffice", "inventory-movements", productId] as const;

function movementLabel(type: InventoryMovement["type"]): string {
  return {
    ADJUSTMENT: "Ajuste manual",
    CANCELLATION: "Cancelación de orden",
    OPENING: "Inventario inicial",
    SALE: "Venta",
  }[type];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function InventoryManagement({ productId }: Readonly<{ productId: string }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { session, status } = useSessionStore();
  const [notice, setNotice] = useState<string>();
  const page = pageSchema.parse(searchParams.get("page") ?? "1");
  const accessToken = session?.accessToken ?? "";
  const isAdmin = session?.user.role === "ADMIN";
  const form = useForm<AdjustmentFormValues>({
    defaultValues: { direction: "ADD", quantity: 1, reason: "" },
    mode: "onSubmit",
    resolver: zodResolver(adjustmentFormSchema),
  });
  const direction = useWatch({ control: form.control, name: "direction" });

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [router, status]);

  const productQuery = useQuery({
    enabled: isAdmin,
    queryFn: () => getAdministrativeProduct(accessToken, productId),
    queryKey: productKey(productId),
  });
  const movementsQuery = useQuery({
    enabled: isAdmin,
    queryFn: () => listInventoryMovements(accessToken, productId, page),
    queryKey: [...movementKey(productId), { page }],
  });

  const adjustmentMutation = useMutation({
    mutationFn: (input: InventoryAdjustmentRequest) => adjustInventory(accessToken, productId, input),
    onError: (error: Error) => setNotice(error.message),
    onSuccess: async (result) => {
      const currentProduct = queryClient.getQueryData<typeof productQuery.data>(productKey(productId));
      if (currentProduct) {
        queryClient.setQueryData(productKey(productId), {
          ...currentProduct,
          availability: result.availableQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
          stockAvailable: result.availableQuantity,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productKey(productId) }),
        queryClient.invalidateQueries({ queryKey: movementKey(productId) }),
        queryClient.invalidateQueries({ queryKey: ["backoffice", "products"] }),
      ]);
      form.reset({ direction: "ADD", quantity: 1, reason: "" });
      setNotice(`Inventario actualizado: ${result.availableQuantity} unidades disponibles. Movimiento registrado.`);
    },
  });

  const movementColumns = useMemo<readonly DataTableColumn<InventoryMovement>[]>(
    () => [
      {
        cell: (movement) => (
          <div>
            <p className="m-0 font-bold text-slate-950">{movementLabel(movement.type)}</p>
            <p className="m-0 mt-1 text-xs text-slate-500">{formatDate(movement.createdAt)}</p>
          </div>
        ),
        header: "Movimiento",
        id: "movement",
      },
      {
        cell: (movement) => (
          <span className={`font-mono font-bold ${movement.quantityDelta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}
          </span>
        ),
        header: "Variación",
        id: "delta",
      },
      { cell: (movement) => <span className="font-semibold">{movement.balanceAfter}</span>, header: "Saldo posterior", id: "balance" },
      { cell: (movement) => <span className="text-slate-700">{movement.reason}</span>, header: "Motivo", id: "reason" },
      {
        cell: (movement) => movement.actor ? (
          <div><p className="m-0 font-semibold">{movement.actor.displayName}</p><p className="m-0 text-xs text-slate-500">{movement.actor.email}</p></div>
        ) : <span className="text-slate-500">Sistema</span>,
        header: "Autor",
        id: "actor",
      },
    ],
    [],
  );

  if (status === "initializing") {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Validando acceso…" /></main>;
  }
  if (status === "anonymous") {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Redirigiendo al acceso…" /></main>;
  }
  if (!isAdmin) {
    return <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6"><ErrorState action={<Link className="font-bold underline" href="/">Volver al panel</Link>} message="Tu rol no puede gestionar inventario." title="Acceso restringido" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-slate-300 pb-6">
          <Link className="text-sm font-bold text-blue-800 hover:underline" href="/products">← Volver a productos</Link>
          <p className="mb-0 mt-5 text-xs font-bold uppercase tracking-[.18em] text-blue-800">Inventario · Libro de movimientos</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="mb-0 text-3xl font-bold tracking-tight sm:text-4xl">Ajustar existencias</h1>
              <p className="mb-0 mt-2 text-slate-600">Cada cambio queda asociado a un motivo y a su autor.</p>
            </div>
            {productQuery.data ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-right">
                <p className="m-0 text-xs font-bold uppercase tracking-[.14em] text-blue-800">Stock disponible</p>
                <p className="m-0 mt-1 text-3xl font-bold text-blue-950">{productQuery.data.stockAvailable}</p>
                <p className="m-0 text-xs text-blue-800">{productQuery.data.sku}</p>
              </div>
            ) : null}
          </div>
          {productQuery.data ? <p className="mb-0 mt-4 text-lg font-semibold">{productQuery.data.name}</p> : null}
        </header>

        <div aria-atomic="true" aria-live="polite" className={`min-h-12 py-3 text-sm font-semibold ${notice?.startsWith("Inventario actualizado") ? "text-emerald-800" : "text-rose-800"}`}>{notice}</div>

        {productQuery.isPending ? <LoadingState message="Cargando producto…" /> : null}
        {productQuery.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => productQuery.refetch()} type="button">Reintentar</button>} message="No pudimos cargar el producto solicitado." /> : null}

        {productQuery.data ? (
          <section aria-labelledby="adjustment-title" className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <p className="m-0 text-xs font-bold uppercase tracking-[.16em] text-blue-800">Operación segura</p>
              <h2 className="mb-0 mt-2 text-2xl font-bold" id="adjustment-title">Registrar ajuste</h2>
              <p className="mb-0 mt-2 text-sm text-slate-600">Usa una cantidad positiva y especifica el motivo del conteo, recepción o retiro.</p>
            </div>
            <form className="grid gap-5" noValidate onSubmit={form.handleSubmit((values) => {
              setNotice(undefined);
              adjustmentMutation.mutate({ quantityDelta: values.direction === "ADD" ? values.quantity : -values.quantity, reason: values.reason });
            })}>
              <div className="grid gap-5 sm:grid-cols-[1fr_1fr_2fr]">
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="inventory-direction">Operación</label>
                  <select className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200" id="inventory-direction" {...form.register("direction")}>
                    <option value="ADD">Agregar unidades</option>
                    <option value="REMOVE">Retirar unidades</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="inventory-quantity">Cantidad</label>
                  <input aria-invalid={Boolean(form.formState.errors.quantity)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200 aria-invalid:border-red-700" id="inventory-quantity" inputMode="numeric" type="number" {...form.register("quantity", { valueAsNumber: true })} />
                  {form.formState.errors.quantity ? <p className="m-0 text-sm font-semibold text-red-700" role="alert">{form.formState.errors.quantity.message}</p> : null}
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-semibold text-slate-800" htmlFor="inventory-reason">Motivo</label>
                  <input aria-invalid={Boolean(form.formState.errors.reason)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200 aria-invalid:border-red-700" id="inventory-reason" placeholder="Ej. Recuento de bodega" {...form.register("reason")} />
                  {form.formState.errors.reason ? <p className="m-0 text-sm font-semibold text-red-700" role="alert">{form.formState.errors.reason.message}</p> : null}
                </div>
              </div>
              {direction === "REMOVE" ? <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">El API rechazará el ajuste si supera las existencias disponibles.</p> : null}
              <div className="flex justify-end border-t border-slate-200 pt-5">
                <IconButton className="size-11 rounded-lg border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800 focus-visible:ring-blue-700" busy={adjustmentMutation.isPending} disabled={adjustmentMutation.isPending} icon="check" label={adjustmentMutation.isPending ? "Registrando…" : "Registrar ajuste"} type="submit" />
              </div>
            </form>
          </section>
        ) : null}

        {movementsQuery.isPending ? <LoadingState message="Cargando historial…" /> : null}
        {movementsQuery.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => movementsQuery.refetch()} type="button">Reintentar</button>} message="No pudimos cargar los movimientos de inventario." /> : null}
        {movementsQuery.data ? (
          <section aria-labelledby="movement-list-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="m-0 text-lg font-bold" id="movement-list-title">Historial auditable</h2><p className="m-0 mt-1 text-sm text-slate-600">{movementsQuery.data.totalItems} movimientos registrados</p></div>
              <p className="m-0 text-xs font-semibold uppercase tracking-[.12em] text-slate-500">Más reciente primero</p>
            </div>
            <DataTable caption="Movimientos de inventario" columns={movementColumns} emptyMessage="Este producto todavía no tiene movimientos." rowKey={(movement) => movement.id} rows={movementsQuery.data.items} />
            {movementsQuery.data.totalPages > 0 ? <div className="mt-5"><BackofficePagination page={movementsQuery.data.page} totalPages={movementsQuery.data.totalPages} /></div> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
