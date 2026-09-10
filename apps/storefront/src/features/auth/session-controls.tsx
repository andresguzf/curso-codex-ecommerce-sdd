"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthApiError } from "@technology-ecommerce/api-client";
import { useState } from "react";

import { authClient, useSessionStore } from "./session";
import { broadcastSessionChange } from "./session-provider";

export function SessionControls() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { clear, notice, session, setNotice, status } = useSessionStore();

  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setNotice(null);
    try {
      await authClient.logout();
      clear();
      broadcastSessionChange("logout");
      setNotice("Sesión cerrada correctamente.");
      router.replace("/");
    } catch (error) {
      setNotice(error instanceof AuthApiError ? error.message : "No pudimos cerrar la sesión.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <div aria-live="polite" className="w-full text-center text-sm text-slate-600">{notice}</div>
      {status === "authenticated" && session ? (
        <><span className="text-sm text-slate-600">Hola, {session.user.displayName}</span>{session.user.role === "CUSTOMER" && <><Link href="/account/orders" className="rounded-full px-3 py-2 text-sm font-bold text-blue-700 underline focus-visible:outline-2 focus-visible:outline-blue-700">Mis compras</Link><Link href="/account/invoices" className="rounded-full px-3 py-2 text-sm font-bold text-blue-700 underline focus-visible:outline-2 focus-visible:outline-blue-700">Mis facturas</Link></>}<button disabled={isLoggingOut} onClick={logout} className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60">{isLoggingOut ? "Cerrando sesión…" : "Cerrar sesión"}</button></>
      ) : status === "anonymous" ? (
        <><Link href="/login" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">Ingresar</Link><Link href="/register" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold">Crear cuenta</Link></>
      ) : <span className="text-sm text-slate-500">Restaurando sesión…</span>}
    </div>
  );
}
