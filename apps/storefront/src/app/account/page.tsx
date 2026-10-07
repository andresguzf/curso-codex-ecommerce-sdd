"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import Link from "next/link";
import { storefrontDestinationFor, useSessionStore } from "@/features/auth/session";

export default function AccountPage() {
  const router = useRouter();
  const { session, status } = useSessionStore();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (session && session.user.role !== "CUSTOMER") {
      window.location.assign(storefrontDestinationFor(session.user.role));
    }
  }, [router, session, status]);

  if (status !== "authenticated" || !session || session.user.role !== "CUSTOMER") return (
    <main data-slot="customer-page" className="mx-auto min-h-[70vh] max-w-6xl px-6 py-14">
      <h1 className="text-3xl font-semibold">Tu cuenta</h1><p role="status">Restaurando sesión…</p>
    </main>
  );
  return (
    <main data-slot="customer-page" className="mx-auto min-h-[70vh] max-w-6xl px-6 py-14 sm:py-20">
      <p className="font-mono text-xs tracking-[.16em] text-[var(--ds-accent)] uppercase">Cuenta de cliente</p>
      <h1 className="mt-3 break-words text-4xl font-semibold tracking-tight">{session.user.displayName}</h1>
      <p className="mt-4 text-lg text-[var(--ds-text-muted)]">Tus compras, documentos y favoritos. Todo a mano.</p>
      <nav aria-label="Secciones de tu cuenta" className="mt-10 grid gap-5 md:grid-cols-3">
        {[
          { href: "/account/orders", title: "Mis compras", description: "Consulta tus pedidos y su estado." },
          { href: "/account/invoices", title: "Mis facturas", description: "Revisa tus facturas y descarga tus documentos." },
          { href: "/account/wishlist", title: "Mis deseos", description: "Vuelve a los productos que guardaste para después." },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="group rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface)] p-6 hover:border-[var(--ds-accent)]">
            <span className="flex items-center justify-between gap-3 text-xl font-semibold text-[var(--ds-accent)]">{item.title}<span aria-hidden="true">↗</span></span>
            <span className="mt-4 block leading-6 text-[var(--ds-text-muted)]">{item.description}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
