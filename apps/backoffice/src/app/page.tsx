"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { backofficeDestinationFor, isBackofficeRole, useSessionStore } from "../features/auth/session";
import { Dashboard } from "../features/dashboard/dashboard";

export default function BackofficeHomePage() {
  const router = useRouter();
  const { session, status } = useSessionStore();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (session && !isBackofficeRole(session.user.role)) window.location.assign(backofficeDestinationFor(session.user.role));
  }, [router, session, status]);

  if (status !== "authenticated" || !session || !isBackofficeRole(session.user.role)) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-600">Validando acceso…</main>;
  }
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "BILLING") return null;
  return <Dashboard key={session.user.id + role} session={session} role={role} />;
}
