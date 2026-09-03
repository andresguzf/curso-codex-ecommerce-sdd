import Link from "next/link";
import type { ReactNode } from "react";

export function StorefrontAuthShell({
  children,
  eyebrow,
  title,
}: Readonly<{ children: ReactNode; eyebrow: string; title: string }>) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#07111f] px-5 py-8 text-white sm:px-8 lg:grid lg:grid-cols-[1.08fr_0.92fr] lg:p-0">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_15%_15%,rgba(34,211,238,.24),transparent_30%),radial-gradient(circle_at_85%_82%,rgba(99,102,241,.25),transparent_34%)]" />
      <section className="relative flex min-h-[38vh] flex-col justify-between py-4 lg:min-h-screen lg:px-[8vw] lg:py-12">
        <Link href="/" className="w-fit text-sm font-bold tracking-[0.18em] text-cyan-300 uppercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">
          Nexo / Tech
        </Link>
        <div className="max-w-xl py-12">
          <p className="font-mono text-xs tracking-[0.22em] text-cyan-300 uppercase">Tecnología para avanzar</p>
          <h2 className="mt-5 text-4xl leading-[0.95] font-black tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Tu próxima herramienta empieza aquí.
          </h2>
          <div className="mt-8 h-px w-full bg-gradient-to-r from-cyan-300 via-indigo-400 to-transparent" />
          <p className="mt-7 max-w-md text-base leading-7 text-slate-300">
            Accede a tu carrito, compras y selección de equipos desde una sesión protegida.
          </p>
        </div>
        <p className="hidden font-mono text-[11px] tracking-[0.16em] text-slate-500 uppercase lg:block">Catálogo tecnológico · Santiago</p>
      </section>
      <section className="relative flex items-center justify-center rounded-[2rem] bg-[#f4f7f9] px-5 py-10 text-slate-950 shadow-2xl lg:min-h-screen lg:rounded-none lg:px-[8vw]">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-indigo-600 uppercase">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em]">{title}</h1>
          {children}
        </div>
      </section>
    </main>
  );
}
