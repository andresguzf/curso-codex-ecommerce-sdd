"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthApiError } from "@technology-ecommerce/api-client";
import { useFlashStore } from "@technology-ecommerce/ui";
import { useState } from "react";

import { authClient, useSessionStore } from "./session";
import { broadcastSessionChange } from "./session-provider";

export function SessionControls() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const showFlash = useFlashStore((state) => state.showFlash);
  const { clear, notice, session, setNotice, status } = useSessionStore();

  async function logout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setNotice(null);
    try {
      await authClient.logout();
      clear();
      broadcastSessionChange("logout");
      showFlash("success", "Sesión cerrada correctamente.");
      router.replace("/");
    } catch (error) {
      showFlash("error", error instanceof AuthApiError ? error.message : "No pudimos cerrar la sesión.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <div aria-live="polite" className="w-full text-center text-sm text-slate-600">{notice}</div>
      <nav aria-label="Cuenta y sesión" className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {status === "authenticated" && session ? (
          <>
            <span className="text-sm text-slate-600">Hola, {session.user.displayName}</span>
            {session.user.role === "CUSTOMER" ? (
              <>
                <Link
                  className="rounded-full px-3 py-2 text-sm font-bold text-blue-700 underline focus-visible:outline-2 focus-visible:outline-blue-700"
                  href="/account"
                >
                  Mi cuenta
                </Link>
                <Link
                  className="rounded-full px-3 py-2 text-sm font-bold text-blue-700 underline focus-visible:outline-2 focus-visible:outline-blue-700"
                  href="/account/orders"
                >
                  Mis compras
                </Link>
                <Link
                  className="rounded-full px-3 py-2 text-sm font-bold text-blue-700 underline focus-visible:outline-2 focus-visible:outline-blue-700"
                  href="/account/invoices"
                >
                  Mis facturas
                </Link>
              </>
            ) : null}
            <button
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={logout}
            >
              {isLoggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          </>
        ) : status === "anonymous" ? (
          <>
            <Link className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white" href="/login">
              Ingresar
            </Link>
            <Link className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold" href="/register">
              Crear cuenta
            </Link>
          </>
        ) : (
          <span className="text-sm text-slate-500">Restaurando sesión…</span>
        )}
      </nav>
    </div>
  );
}
