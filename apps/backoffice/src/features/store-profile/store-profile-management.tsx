"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingState, useFlashStore } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSessionStore } from "../auth/session";
import { getStoreProfile, saveStoreProfile, uploadStoreLogo, StoreProfileApiError, type StoreProfilePatch } from "./store-profile-api";
import { StoreProfileForm } from "./store-profile-form";

function safeError(error: unknown): string {
  return error instanceof StoreProfileApiError ? error.message : "No pudimos cargar la información. Inténtalo nuevamente.";
}

export function StoreProfileManagement() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const sessionStatus = useSessionStore((state) => state.status);
  const showFlash = useFlashStore((state) => state.showFlash);
  const canRead = sessionStatus === "authenticated" && (session?.user.role === "ADMIN" || session?.user.role === "BILLING");
  const canEdit = canRead && session?.user.role === "ADMIN";
  const accessToken = canRead ? session.accessToken : "";
  const queryKey = ["backoffice", "store-profile", session?.user.id] as const;

  useEffect(() => {
    if (sessionStatus === "anonymous") router.replace("/login");
  }, [router, sessionStatus]);

  const profileQuery = useQuery({
    enabled: canRead,
    queryKey,
    queryFn: ({ signal }) => getStoreProfile(accessToken, signal),
    gcTime: 0,
    retry: (count, error) => !(error instanceof StoreProfileApiError && error.status < 500) && count < 1,
  });
  const saveMutation = useMutation({
    mutationFn: (input: StoreProfilePatch) => saveStoreProfile(accessToken, input),
    onError: (error) => showFlash("error", safeError(error)),
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKey, profile);
      showFlash("success", "Perfil empresarial guardado.");
    },
  });
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadStoreLogo(accessToken, file),
    onError: (error) => showFlash("error", safeError(error)),
    onSuccess: () => showFlash("success", "Logo cargado. Guarda el perfil para usarlo."),
  });

  if (sessionStatus === "initializing" || (sessionStatus === "authenticated" && !session)) {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Validando acceso…" /></main>;
  }
  if (sessionStatus === "anonymous") {
    return <main className="grid min-h-screen place-items-center"><LoadingState message="Redirigiendo al acceso…" /></main>;
  }
  if (!canRead) {
    return <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6"><ErrorState action={<Link className="font-bold underline" href="/">Volver al panel</Link>} message="Tu rol no puede consultar el perfil empresarial." title="Acceso restringido" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 border-b border-slate-300 pb-6">
          <Link className="text-sm font-bold text-blue-800 hover:underline" href="/">← Panel principal</Link>
          <p className="mb-0 mt-5 text-xs font-bold uppercase tracking-[.18em] text-blue-800">Configuración · Emisor</p>
          <h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Perfil empresarial</h1>
          <p className="mb-0 mt-2 text-slate-600">Identidad de la tienda para órdenes, facturas y documentos.</p>
        </header>
        {profileQuery.isPending ? <LoadingState message="Cargando perfil empresarial…" />
          : profileQuery.isError ? <ErrorState action={<button className="font-bold underline" onClick={() => void profileQuery.refetch()} type="button">Reintentar</button>} message={safeError(profileQuery.error)} />
            : <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div><p className="m-0 text-xs font-bold uppercase tracking-[.16em] text-blue-800">Estado del emisor</p><p className="mb-0 mt-1 font-semibold text-slate-900">{profileQuery.data ? "Perfil configurado" : "Pendiente de configuración"}</p></div>
                {profileQuery.data ? <time className="text-sm text-slate-700" dateTime={profileQuery.data.updatedAt}>Actualizado {new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" }).format(new Date(profileQuery.data.updatedAt))}</time> : null}
              </div>
              {canEdit ? <StoreProfileForm isPending={saveMutation.isPending} isUploading={uploadMutation.isPending} key={profileQuery.data?.updatedAt ?? "new"} onSubmit={(input) => saveMutation.mutate(input)} onUpload={(file) => uploadMutation.mutateAsync(file)} profile={profileQuery.data} />
                : profileQuery.data ? <div className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
                  <div><h2 className="mt-0 text-xl font-bold">Identidad fiscal</h2><dl className="grid gap-3 text-sm"><div><dt className="font-bold text-slate-600">Nombre comercial</dt><dd className="m-0">{profileQuery.data.tradeName}</dd></div><div><dt className="font-bold text-slate-600">Razón social</dt><dd className="m-0">{profileQuery.data.legalName}</dd></div><div><dt className="font-bold text-slate-600">Identificador fiscal</dt><dd className="m-0">{profileQuery.data.taxIdentifier}</dd></div></dl></div>
                  <div><h2 className="mt-0 text-xl font-bold">Dirección y contacto</h2><address className="not-italic">{profileQuery.data.address.line1}{profileQuery.data.address.line2 ? `, ${profileQuery.data.address.line2}` : ""}<br />{profileQuery.data.address.city}{profileQuery.data.address.region ? `, ${profileQuery.data.address.region}` : ""}{profileQuery.data.address.postalCode ? ` ${profileQuery.data.address.postalCode}` : ""}<br />{profileQuery.data.address.countryCode}</address>{profileQuery.data.contact.email ? <p className="mb-0 mt-3">{profileQuery.data.contact.email}</p> : null}{profileQuery.data.contact.phone ? <p className="mb-0 mt-1">{profileQuery.data.contact.phone}</p> : null}{profileQuery.data.logo ? <p className="mb-0 mt-3"><a className="font-bold text-blue-800 underline" href={profileQuery.data.logo.url} rel="noopener noreferrer" target="_blank">Ver logo actual</a></p> : null}</div>
                  <p className="m-0 text-sm text-slate-600 sm:col-span-2">Tu rol puede consultar estos datos, pero solo Administración puede modificarlos.</p>
                </div> : <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">Un administrador debe configurar el perfil empresarial antes de que aparezcan estos datos.</div>}
            </>}
      </div>
    </main>
  );
}
