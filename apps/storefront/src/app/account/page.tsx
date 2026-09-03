"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { SessionControls } from "@/features/auth/session-controls";
import { useSessionStore } from "@/features/auth/session";

export default function AccountPage() {
  const router = useRouter();
  const { session, status } = useSessionStore();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [router, status]);

  if (status !== "authenticated" || !session) return <main className="grid min-h-screen place-items-center">Restaurando sesión…</main>;
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><section className="max-w-lg text-center"><p className="font-mono text-xs tracking-[.2em] text-indigo-600 uppercase">Cuenta de cliente</p><h1 className="mt-3 text-4xl font-black tracking-tight">{session.user.displayName}</h1><p className="mt-4 text-slate-600">Tu sesión vive solo en memoria y se restaura de forma segura al recargar.</p><div className="mt-8"><SessionControls /></div></section></main>;
}
