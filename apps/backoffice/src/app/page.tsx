"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogoutButton } from "@/features/auth/logout-button";
import { backofficeDestinationFor, isBackofficeRole, useSessionStore } from "@/features/auth/session";

export default function BackofficeHomePage() {
  const router = useRouter();
  const { notice, session, status } = useSessionStore();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (session && !isBackofficeRole(session.user.role)) window.location.assign(backofficeDestinationFor(session.user.role));
  }, [router, session, status]);

  if (status !== "authenticated" || !session || !isBackofficeRole(session.user.role)) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-600">Validando acceso…</main>;
  }
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <section className="max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">
          Backoffice
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Administración de la tienda
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          Aplicación administrativa inicializada con Next.js, TypeScript, App
          Router y Tailwind CSS.
        </p>
        <p className="mt-5 text-sm font-semibold text-blue-700">{session.user.displayName} · {session.user.role}</p>
        <p aria-live="polite" className="mt-3 text-sm text-slate-600">{notice}</p>
        <div className="mt-7"><LogoutButton /></div>
      </section>
    </main>
  );
}
