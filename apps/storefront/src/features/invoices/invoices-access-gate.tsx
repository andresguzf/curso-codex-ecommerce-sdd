"use client";

import { LoadingState } from "@technology-ecommerce/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSessionStore } from "../auth/session";

export function InvoicesAccessGate({ children, returnTo }: Readonly<{ children: ReactNode; returnTo: string }>) {
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [returnTo, router, status]);

  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 sm:px-8 sm:py-14"><div className="mx-auto max-w-5xl">
    {status !== "authenticated" || !session ? <LoadingState message="Validando acceso a tus facturas…" />
      : session.user.role !== "CUSTOMER" ? <section><h1 className="text-3xl font-black">Área de clientes</h1><p className="my-4">Para consultar facturas propias utiliza una cuenta de cliente.</p><Link href="/" className="font-bold text-blue-700 underline">Volver a la tienda</Link></section>
        : children}
  </div></main>;
}
