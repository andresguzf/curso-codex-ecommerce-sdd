"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ClassificationListQuery, type ClassificationStatus } from "@technology-ecommerce/api-schemas";
import {
  ConfirmationDialog,
  DataTable,
  ErrorState,
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
  createClassification,
  deleteClassification,
  listClassifications,
  updateClassification,
  ClassificationApiError,
  type ClassificationInput,
  type ClassificationKind,
  type ClassificationRecord,
} from "./classification-api";
import { ClassificationForm } from "./classification-form";
import { classificationQueryToParams, parseClassificationQuery } from "./classification-query";

type FormTarget = Readonly<{ mode: "create" }> | Readonly<{ mode: "edit"; record: ClassificationRecord }>;
type ConfirmationTarget = Readonly<{ action: "deactivate" | "delete"; record: ClassificationRecord }>;

function operationError(error: unknown): string {
  return error instanceof ClassificationApiError ? error.message : "No pudimos completar la operación. Inténtalo nuevamente.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(value));
}

export function ClassificationManagement({ kind }: Readonly<{ kind: ClassificationKind }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseClassificationQuery(new URLSearchParams(searchParams.toString()));
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const sessionStatus = useSessionStore((state) => state.status);
  const showFlash = useFlashStore((state) => state.showFlash);
  const [formTarget, setFormTarget] = useState<FormTarget>();
  const [confirmation, setConfirmation] = useState<ConfirmationTarget>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isAdmin = sessionStatus === "authenticated" && session?.user.role === "ADMIN";
  const accessToken = isAdmin ? session.accessToken : "";
  const queryRoot = ["backoffice", kind] as const;
  const plural = kind === "categories" ? "Categorías" : "Etiquetas";
  const singular = kind === "categories" ? "categoría" : "etiqueta";

  useEffect(() => {
    if (sessionStatus === "anonymous") router.replace("/login");
  }, [router, sessionStatus]);

  const listQuery = useQuery({
    enabled: isAdmin,
    queryFn: ({ signal }) => kind === "categories"
      ? listClassifications("categories", accessToken, filters, signal)
      : listClassifications("tags", accessToken, filters, signal),
    queryKey: [...queryRoot, filters],
  });
  const saveMutation = useMutation({
    mutationFn: ({ target, input }: Readonly<{ target: FormTarget; input: ClassificationInput }>) => target.mode === "edit"
      ? updateClassification(kind, accessToken, target.record.id, input)
      : createClassification(kind, accessToken, input),
    onError: (error) => showFlash("error", operationError(error)),
    onSuccess: (_record, variables) => {
      showFlash("success", `${singular[0]!.toUpperCase()}${singular.slice(1)} ${variables.target.mode === "edit" ? "actualizada" : "creada"}.`);
      setFormTarget(undefined);
      void queryClient.invalidateQueries({ queryKey: queryRoot });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ record, status }: Readonly<{ record: ClassificationRecord; status: ClassificationStatus }>) => updateClassification(kind, accessToken, record.id, { status }),
    onError: (error) => {
      setConfirmation(undefined);
      showFlash("error", operationError(error));
    },
    onSuccess: (_record, variables) => {
      setConfirmation(undefined);
      showFlash("success", `${singular[0]!.toUpperCase()}${singular.slice(1)} ${variables.status === "ACTIVE" ? "activada" : "desactivada"}.`);
      void queryClient.invalidateQueries({ queryKey: queryRoot });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (record: ClassificationRecord) => deleteClassification(kind, accessToken, record.id),
    onError: (error) => {
      setConfirmation(undefined);
      showFlash("error", operationError(error));
    },
    onSuccess: () => {
      setConfirmation(undefined);
      showFlash("success", `${singular[0]!.toUpperCase()}${singular.slice(1)} eliminada lógicamente.`);
      void queryClient.invalidateQueries({ queryKey: queryRoot });
    },
  });

  function navigate(updates: Partial<ClassificationListQuery>) {
    const params = classificationQueryToParams({ ...filters, ...updates });
    router.push(`/${kind}?${params.toString()}`, { scroll: false });
  }

  function applyFilters(formData: FormData) {
    const status = String(formData.get("status") ?? "") as ClassificationStatus | "";
    navigate({
      page: 1,
      pageSize: Number(formData.get("pageSize") ?? 20),
      status: status || undefined,
      sortBy: String(formData.get("sortBy") ?? "createdAt") as ClassificationListQuery["sortBy"],
      sortOrder: String(formData.get("sortOrder") ?? "desc") as ClassificationListQuery["sortOrder"],
    });
    setFiltersOpen(false);
  }

  function confirmAction() {
    if (!confirmation) return;
    if (confirmation.action === "delete") deleteMutation.mutate(confirmation.record);
    else statusMutation.mutate({ record: confirmation.record, status: "INACTIVE" });
  }

  const columns: readonly DataTableColumn<ClassificationRecord>[] = [
    { id: "name", header: "Nombre", cell: (record) => <div><p className="m-0 font-bold">{record.name}</p><p className="m-0 mt-1 font-mono text-xs text-slate-500">/{record.slug}</p></div> },
    ...(kind === "categories" ? [{ id: "description", header: "Descripción", cell: (record: ClassificationRecord) => <span className="line-clamp-2 max-w-xs text-sm text-slate-600">{"description" in record ? record.description || "Sin descripción" : ""}</span> }] : []),
    { id: "status", header: "Estado", cell: (record) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${record.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{record.status === "ACTIVE" ? "Activo" : "Inactivo"}</span> },
    { id: "updatedAt", header: "Actualización", cell: (record) => <time dateTime={record.updatedAt}>{formatDate(record.updatedAt)}</time> },
    { id: "actions", header: "Acciones", cell: (record) => (
      <div className="flex min-w-36 flex-wrap gap-2">
        <IconButton icon="edit" label={`Editar ${record.name}`} onClick={() => { saveMutation.reset(); setFormTarget({ mode: "edit", record }); }} />
        {record.status === "ACTIVE"
          ? <IconButton className="border-amber-300 text-amber-900 hover:bg-amber-50" icon="power" label={`Desactivar ${record.name}`} onClick={() => setConfirmation({ action: "deactivate", record })} />
          : <IconButton className="border-emerald-300 text-emerald-800 hover:bg-emerald-50" disabled={statusMutation.isPending} icon="power" label={`Activar ${record.name}`} onClick={() => statusMutation.mutate({ record, status: "ACTIVE" })} />}
        <IconButton className="border-red-300 text-red-800 hover:bg-red-50" icon="trash" label={`Eliminar ${record.name}`} onClick={() => setConfirmation({ action: "delete", record })} />
      </div>
    ) },
  ];

  if (sessionStatus === "initializing" || (sessionStatus === "authenticated" && !session)) {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Validando acceso…" /></main>;
  }
  if (sessionStatus === "anonymous") {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Redirigiendo al acceso…" /></main>;
  }
  if (!isAdmin) {
    return <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6"><ErrorState action={<Link className="font-bold underline" href="/">Volver al panel</Link>} message={`Tu rol no puede administrar ${plural.toLowerCase()}.`} title="Acceso restringido" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-[90rem]">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-300 pb-6">
          <div>
            <Link className="text-sm font-bold text-blue-800 hover:underline" href="/products">← Volver a productos</Link>
            <p className="mb-0 mt-5 text-xs font-bold uppercase tracking-[.18em] text-blue-800">Catálogo · Clasificación</p>
            <h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{plural}</h1>
            <p className="mb-0 mt-2 text-slate-600">{kind === "categories" ? "Organiza los productos por su categoría principal." : "Añade etiquetas para encontrar y agrupar productos."}</p>
          </div>
          <IconButton className="size-11 border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800" icon="plus" label={`Nueva ${singular}`} onClick={() => { saveMutation.reset(); setFormTarget({ mode: "create" }); }} />
        </header>

        <nav aria-label="Clasificación del catálogo" className="mt-5 flex gap-2 border-b border-slate-300">
          <Link aria-current={kind === "categories" ? "page" : undefined} className={`rounded-t-lg px-4 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${kind === "categories" ? "bg-white text-[#15345b]" : "text-slate-600 hover:bg-slate-200"}`} href="/categories">Categorías</Link>
          <Link aria-current={kind === "tags" ? "page" : undefined} className={`rounded-t-lg px-4 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${kind === "tags" ? "bg-white text-[#15345b]" : "text-slate-600 hover:bg-slate-200"}`} href="/tags">Etiquetas</Link>
        </nav>

        {formTarget ? (
          <section aria-labelledby="classification-form-title" className="my-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="mt-0 text-2xl font-bold" id="classification-form-title">{formTarget.mode === "edit" ? `Editar ${formTarget.record.name}` : `Crear ${singular}`}</h2>
            <ClassificationForm isPending={saveMutation.isPending} key={formTarget.mode === "edit" ? formTarget.record.id : `create-${kind}`} kind={kind} onCancel={() => setFormTarget(undefined)} onSubmit={(input) => saveMutation.mutate({ target: formTarget, input })} record={formTarget.mode === "edit" ? formTarget.record : undefined} />
          </section>
        ) : null}

        <BackofficeListLayout
          filters={<form className="grid gap-4" key={`filters-${searchParams.toString()}`} onSubmit={(event) => { event.preventDefault(); applyFilters(new FormData(event.currentTarget)); }}>
            <label className="grid gap-1 text-sm font-semibold">Estado<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.status ?? ""} name="status"><option value="">Todos</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Registros por página<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.pageSize} name="pageSize"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Ordenar por<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortBy} name="sortBy"><option value="createdAt">Fecha de alta</option><option value="updatedAt">Actualización</option><option value="name">Nombre</option><option value="slug">Slug</option><option value="status">Estado</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Dirección<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortOrder} name="sortOrder"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label>
            <button className="min-h-11 rounded-lg bg-[#15345b] px-4 font-bold text-white" type="submit">Aplicar filtros</button>
            <button className="text-center font-bold text-blue-700 underline" onClick={() => { navigate({ page: 1, status: undefined, pageSize: 20, sortBy: "createdAt", sortOrder: "desc" }); setFiltersOpen(false); }} type="button">Restablecer</button>
          </form>}
          filtersOpen={filtersOpen}
          filtersTitle={`Filtros de ${plural.toLowerCase()}`}
          onFiltersOpenChange={setFiltersOpen}
          search={<BackofficeListSearch label={`Buscar ${plural.toLowerCase()}`} onClear={() => navigate({ page: 1, search: undefined })} onSearch={(search) => navigate({ page: 1, search: search || undefined })} placeholder={kind === "categories" ? "Nombre, slug o descripción" : "Nombre o slug"} value={filters.search} />}
        >
          <section aria-labelledby="classification-list-title" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold" id="classification-list-title">Listado de {plural.toLowerCase()}</h2><p className="m-0 text-sm text-slate-600">{listQuery.data ? `${listQuery.data.totalItems} registros` : "Consultando registros"}</p></div>
            {listQuery.isPending ? <LoadingState message={`Cargando ${plural.toLowerCase()}…`} /> : listQuery.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => { void listQuery.refetch(); }} type="button">Reintentar</button>} message={operationError(listQuery.error)} /> : (
              <>
                <DataTable caption={`${plural} administrativas`} columns={columns} emptyMessage={`No hay ${plural.toLowerCase()} que coincidan con los criterios.`} rowKey={(record) => record.id} rows={listQuery.data.items} />
                {listQuery.data.totalPages > 0 && filters.page <= listQuery.data.totalPages ? <div className="mt-5"><BackofficePagination page={listQuery.data.page} totalPages={listQuery.data.totalPages} /></div> : filters.page > 1 ? <button className="mt-5 font-bold text-blue-700 underline" onClick={() => navigate({ page: 1 })} type="button">Volver a la primera página</button> : null}
              </>
            )}
          </section>
        </BackofficeListLayout>
      </div>
      <ConfirmationDialog
        confirmLabel={confirmation?.action === "delete" ? `Eliminar ${singular}` : `Desactivar ${singular}`}
        description={confirmation ? `${confirmation.record.name} ${confirmation.action === "delete" ? "se eliminará lógicamente" : "quedará inactiva"}. Las referencias históricas se conservarán.` : ""}
        isPending={statusMutation.isPending || deleteMutation.isPending}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={confirmAction}
        open={Boolean(confirmation)}
        title={confirmation?.action === "delete" ? `¿Eliminar esta ${singular}?` : `¿Desactivar esta ${singular}?`}
      />
    </main>
  );
}
