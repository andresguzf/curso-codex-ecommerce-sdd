"use client";

import { ErrorState, LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { backofficeDestinationFor, isBackofficeRole, useSessionStore } from "../auth/session";

export function OrdersAccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const status = useSessionStore((state) => state.status);
  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (session && !isBackofficeRole(session.user.role)) window.location.assign(backofficeDestinationFor(session.user.role));
  }, [router, session, status]);
  if (status !== "authenticated" || !session) return <main className="grid min-h-screen place-items-center"><LoadingState message="Validando acceso a órdenes…" /></main>;
  if (!isBackofficeRole(session.user.role)) return <main className="grid min-h-screen place-items-center"><ErrorState title="Acceso restringido" message="Esta sección requiere un rol administrativo." /></main>;
  return children;
}

export function OrdersHeader({ title, description }: Readonly<{ title: string; description: string }>) {
  const session = useSessionStore((state) => state.session)!;
  return <header className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-300 pb-6">
    <div><Link className="text-sm font-bold text-blue-800 hover:underline" href="/">← Panel principal</Link><p className="mb-0 mt-5 text-xs font-bold uppercase tracking-[.18em] text-blue-800">Operaciones · {session.user.role === "ADMIN" ? "Administración" : "Facturación"}</p><h1 className="mb-0 mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1><p className="mb-0 mt-2 max-w-2xl text-slate-600">{description}</p></div>
    <div className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"><span className="font-bold">{session.user.displayName}</span><span className="ml-2 text-slate-500">{session.user.role}</span></div>
  </header>;
}
