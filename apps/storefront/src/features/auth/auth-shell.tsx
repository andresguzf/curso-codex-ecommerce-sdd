import Link from "next/link";
import type { ReactNode } from "react";

export function StorefrontAuthShell({
  children,
  eyebrow,
  title,
}: Readonly<{ children: ReactNode; eyebrow: string; title: string }>) {
  return (
    <main data-slot="storefront-auth" className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:py-20">
      <section className="max-w-lg">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--ds-accent)]">Technology Store / Inicio</Link>
        <p className="mt-8 font-mono text-xs tracking-[0.16em] text-[var(--ds-text-muted)] uppercase">Tecnología para avanzar</p>
        <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">Tu próxima herramienta empieza aquí.</h2>
        <p className="mt-6 max-w-md text-lg leading-7 text-[var(--ds-text-muted)]">Guarda tus favoritos y encuentra tus compras en un solo lugar. Puedes explorar y agregar productos al carrito sin iniciar sesión.</p>
      </section>
      <section className="rounded-2xl border border-[var(--ds-border-subtle)] bg-[var(--ds-surface)] p-6 sm:p-9">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-indigo-600 uppercase">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}
