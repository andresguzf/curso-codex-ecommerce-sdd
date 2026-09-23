"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUserRequestSchema,
  type AdministrativeUser,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserListQuery,
  type UserStatus,
} from "@technology-ecommerce/api-schemas";
import {
  CollapsibleSidePanel,
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
import { useSessionStore } from "../auth/session";
import { createUser, deleteUser, listUsers, updateUser, UserApiError } from "./user-api";
import { UserForm } from "./user-form";
import { parseUserFilters, userFiltersToParams } from "./user-query";

const userQueryRoot = ["backoffice", "users"] as const;
const roleLabels = { CUSTOMER: "Cliente", ADMIN: "Administrador", BILLING: "Facturación" } as const;
const statusLabels = { ACTIVE: "Activo", INACTIVE: "Inactivo", BLOCKED: "Bloqueado" } as const;

type FormTarget = Readonly<{ mode: "create" }> | Readonly<{ mode: "edit"; user: AdministrativeUser }>;
type ConfirmationTarget = Readonly<{ action: "deactivate" | "block" | "delete"; user: AdministrativeUser }>;

function mutationError(error: unknown): string {
  return error instanceof UserApiError ? error.message : "No pudimos completar la operación. Inténtalo nuevamente.";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(value));
}

export function UserManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseUserFilters(new URLSearchParams(searchParams.toString()));
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const sessionStatus = useSessionStore((state) => state.status);
  const showFlash = useFlashStore((state) => state.showFlash);
  const [formTarget, setFormTarget] = useState<FormTarget>();
  const [confirmation, setConfirmation] = useState<ConfirmationTarget>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isAdmin = sessionStatus === "authenticated" && session?.user.role === "ADMIN";
  const accessToken = isAdmin ? session.accessToken : "";

  useEffect(() => {
    if (sessionStatus === "anonymous") router.replace("/login");
  }, [router, sessionStatus]);

  const usersQuery = useQuery({
    enabled: isAdmin,
    queryFn: ({ signal }) => listUsers(accessToken, filters, signal),
    queryKey: [...userQueryRoot, filters],
  });

  const saveMutation = useMutation({
    mutationFn: ({ target, input }: Readonly<{ target: FormTarget; input: CreateUserRequest | UpdateUserRequest }>) =>
      target.mode === "edit"
        ? updateUser(accessToken, target.user.id, input)
        : createUser(accessToken, createUserRequestSchema.parse(input)),
    onError: (error) => showFlash("error", mutationError(error)),
    onSuccess: (_result, variables) => {
      showFlash("success", variables.target.mode === "edit" ? "Usuario actualizado." : "Usuario creado.");
      setFormTarget(undefined);
      void queryClient.invalidateQueries({ queryKey: userQueryRoot });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ user, status }: Readonly<{ user: AdministrativeUser; status: UserStatus }>) =>
      updateUser(accessToken, user.id, { status }),
    onError: (error) => {
      setConfirmation(undefined);
      showFlash("error", mutationError(error));
    },
    onSuccess: (_result, variables) => {
      setConfirmation(undefined);
      showFlash("success", `Usuario ${variables.status === "ACTIVE" ? "activado" : variables.status === "BLOCKED" ? "bloqueado" : "desactivado"}.`);
      void queryClient.invalidateQueries({ queryKey: userQueryRoot });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (user: AdministrativeUser) => deleteUser(accessToken, user.id),
    onError: (error) => {
      setConfirmation(undefined);
      showFlash("error", mutationError(error));
    },
    onSuccess: () => {
      setConfirmation(undefined);
      showFlash("success", "Usuario eliminado lógicamente.");
      void queryClient.invalidateQueries({ queryKey: userQueryRoot });
    },
  });

  function navigate(updates: Partial<UserListQuery>) {
    const next = userFiltersToParams({ ...filters, ...updates });
    router.push(`/users?${next.toString()}`, { scroll: false });
  }

  function applyFilters(formData: FormData) {
    const role = String(formData.get("role") ?? "") as UserListQuery["role"] | "";
    const status = String(formData.get("status") ?? "") as UserListQuery["status"] | "";
    navigate({
      page: 1,
      pageSize: Number(formData.get("pageSize") ?? 20),
      role: role || undefined,
      status: status || undefined,
      sortBy: String(formData.get("sortBy") ?? "createdAt") as UserListQuery["sortBy"],
      sortOrder: String(formData.get("sortOrder") ?? "desc") as UserListQuery["sortOrder"],
    });
    setFiltersOpen(false);
  }

  function confirmAction() {
    if (!confirmation) return;
    if (confirmation.action === "delete") deleteMutation.mutate(confirmation.user);
    else statusMutation.mutate({
      user: confirmation.user,
      status: confirmation.action === "block" ? "BLOCKED" : "INACTIVE",
    });
  }

  const columns: readonly DataTableColumn<AdministrativeUser>[] = [
    { id: "user", header: "Usuario", cell: (user) => <div><p className="m-0 font-bold">{user.displayName}</p><p className="m-0 mt-1 break-all text-xs text-slate-500">{user.email}</p></div> },
    { id: "role", header: "Rol", cell: (user) => <span className="font-semibold">{roleLabels[user.role]}</span> },
    { id: "status", header: "Estado", cell: (user) => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${user.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : user.status === "BLOCKED" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-700"}`}>{statusLabels[user.status]}</span> },
    { id: "createdAt", header: "Alta", cell: (user) => <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time> },
    { id: "actions", header: "Acciones", cell: (user) => (
      <div className="flex min-w-44 flex-wrap gap-2">
        <IconButton icon="edit" label={`Editar ${user.displayName}`} onClick={() => { saveMutation.reset(); setFormTarget({ mode: "edit", user }); }} />
        {user.status === "ACTIVE" ? (
          <>
            <IconButton className="border-amber-300 text-amber-900 hover:bg-amber-50" icon="power" label={`Desactivar ${user.displayName}`} onClick={() => setConfirmation({ action: "deactivate", user })} />
            <IconButton className="border-orange-300 text-orange-900 hover:bg-orange-50" icon="x" label={`Bloquear ${user.displayName}`} onClick={() => setConfirmation({ action: "block", user })} />
          </>
        ) : (
          <IconButton className="border-emerald-300 text-emerald-800 hover:bg-emerald-50" disabled={statusMutation.isPending} icon="power" label={`Activar ${user.displayName}`} onClick={() => statusMutation.mutate({ user, status: "ACTIVE" })} />
        )}
        <IconButton className="border-red-300 text-red-800 hover:bg-red-50" icon="trash" label={`Eliminar ${user.displayName}`} onClick={() => setConfirmation({ action: "delete", user })} />
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
    return <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6"><ErrorState action={<Link className="font-bold underline" href="/">Volver al panel</Link>} message="Tu rol no puede administrar usuarios." title="Acceso restringido" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-[90rem]">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-300 pb-6">
          <div><Link className="text-sm font-bold text-blue-800 hover:underline" href="/">← Panel principal</Link><p className="mb-0 mt-5 text-xs font-bold uppercase tracking-[.18em] text-blue-800">Identidad · Administración</p><h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Usuarios</h1><p className="mb-0 mt-2 text-slate-600">Gestiona cuentas y permisos sin alterar su historial comercial.</p></div>
          <IconButton className="size-11 border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800" icon="plus" label="Nuevo usuario" onClick={() => { saveMutation.reset(); setFormTarget({ mode: "create" }); }} />
        </header>

        {formTarget ? <section aria-labelledby="user-form-title" className="my-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="mt-0 text-2xl font-bold" id="user-form-title">{formTarget.mode === "edit" ? `Editar ${formTarget.user.displayName}` : "Crear usuario"}</h2><UserForm isPending={saveMutation.isPending} key={formTarget.mode === "edit" ? formTarget.user.id : "create"} onCancel={() => setFormTarget(undefined)} onSubmit={(input) => saveMutation.mutate({ target: formTarget, input })} user={formTarget.mode === "edit" ? formTarget.user : undefined} /></section> : null}

        <form className="my-6 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4" key={`search-${filters.search ?? ""}`} onSubmit={(event) => { event.preventDefault(); navigate({ page: 1, search: String(new FormData(event.currentTarget).get("search") ?? "").trim() || undefined }); }}>
          <label className="sr-only" htmlFor="user-search">Buscar usuarios</label><input className="min-h-11 min-w-56 flex-1 rounded-lg border border-slate-300 px-4" defaultValue={filters.search} id="user-search" maxLength={200} name="search" placeholder="Nombre o correo electrónico" type="search" /><button className="rounded-lg bg-[#15345b] px-5 py-2 font-bold text-white" type="submit">Buscar</button>{filters.search ? <button className="font-bold text-blue-700 underline" onClick={() => navigate({ page: 1, search: undefined })} type="button">Limpiar búsqueda</button> : null}
        </form>

        <div className="flex items-stretch gap-2">
          <section aria-labelledby="user-list-title" className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-lg font-bold" id="user-list-title">Cuentas registradas</h2><p className="m-0 text-sm text-slate-600">{usersQuery.data ? `${usersQuery.data.totalItems} usuarios` : "Consultando usuarios"}</p></div>
            {usersQuery.isPending ? <LoadingState message="Cargando usuarios…" /> : usersQuery.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => { void usersQuery.refetch(); }} type="button">Reintentar</button>} message={mutationError(usersQuery.error)} /> : <><DataTable caption="Usuarios administrativos" columns={columns} emptyMessage="No hay usuarios que coincidan con los criterios." rowKey={(user) => user.id} rows={usersQuery.data.items} />{usersQuery.data.totalPages > 0 && filters.page <= usersQuery.data.totalPages ? <div className="mt-5"><BackofficePagination page={usersQuery.data.page} totalPages={usersQuery.data.totalPages} /></div> : filters.page > 1 ? <button className="mt-5 font-bold text-blue-700 underline" onClick={() => navigate({ page: 1 })} type="button">Volver a la primera página</button> : null}</>}
          </section>
          <div className="flex shrink-0 items-center"><IconButton ariaExpanded={filtersOpen} className="border-slate-300 text-slate-700 hover:bg-slate-100" icon={filtersOpen ? "chevron-left" : "chevron-right"} label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"} onClick={() => setFiltersOpen((open) => !open)} /></div>
          <CollapsibleSidePanel onClose={() => setFiltersOpen(false)} open={filtersOpen} title="Filtros de usuarios">
            <form className="grid gap-4" key={`filters-${searchParams.toString()}`} onSubmit={(event) => { event.preventDefault(); applyFilters(new FormData(event.currentTarget)); }}>
              <label className="grid gap-1 text-sm font-semibold">Rol<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.role ?? ""} name="role"><option value="">Todos</option><option value="CUSTOMER">Cliente</option><option value="ADMIN">Administrador</option><option value="BILLING">Facturación</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Estado<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.status ?? ""} name="status"><option value="">Todos</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option><option value="BLOCKED">Bloqueado</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Usuarios por página<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.pageSize} name="pageSize"><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Ordenar por<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortBy} name="sortBy"><option value="createdAt">Fecha de alta</option><option value="displayName">Nombre</option><option value="email">Correo</option><option value="role">Rol</option><option value="status">Estado</option></select></label>
              <label className="grid gap-1 text-sm font-semibold">Dirección<select className="min-h-11 rounded-lg border border-slate-300 px-3" defaultValue={filters.sortOrder} name="sortOrder"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select></label>
              <button className="min-h-11 rounded-lg bg-[#15345b] px-4 font-bold text-white" type="submit">Aplicar filtros</button><Link className="text-center font-bold text-blue-700 underline" href="/users" onClick={() => setFiltersOpen(false)}>Restablecer</Link>
            </form>
          </CollapsibleSidePanel>
        </div>
      </div>
      <ConfirmationDialog
        confirmLabel={confirmation?.action === "delete" ? "Eliminar usuario" : confirmation?.action === "block" ? "Bloquear usuario" : "Desactivar usuario"}
        description={confirmation ? `La cuenta de ${confirmation.user.displayName} ${confirmation.action === "delete" ? "se eliminará lógicamente" : confirmation.action === "block" ? "quedará bloqueada" : "quedará inactiva"}. Su historial se conservará.` : ""}
        isPending={statusMutation.isPending || deleteMutation.isPending}
        onCancel={() => setConfirmation(undefined)}
        onConfirm={confirmAction}
        open={Boolean(confirmation)}
        title={confirmation?.action === "delete" ? "¿Eliminar este usuario?" : confirmation?.action === "block" ? "¿Bloquear este usuario?" : "¿Desactivar este usuario?"}
      />
    </main>
  );
}
