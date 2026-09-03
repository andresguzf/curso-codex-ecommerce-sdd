import { BackofficeLoginForm } from "@/features/auth/login-form";

export default function BackofficeLoginPage() {
  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#e9eef3] lg:grid-cols-[minmax(18rem,38%)_1fr]">
      <aside className="relative flex min-h-64 flex-col justify-between overflow-hidden bg-[#0c1d34] p-8 text-white lg:min-h-screen lg:p-12">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:42px_42px]" />
        <p className="relative font-mono text-xs tracking-[.2em] text-blue-300 uppercase">Nexo Operations</p>
        <div className="relative max-w-sm py-12">
          <p className="text-sm font-semibold text-blue-300">Portal interno</p>
          <h2 className="mt-4 text-4xl font-black tracking-[-.04em] lg:text-5xl">Control claro. Decisiones rápidas.</h2>
          <p className="mt-5 leading-7 text-slate-300">Un acceso dedicado para administrar la operación comercial y el ciclo de facturación.</p>
        </div>
        <p className="relative hidden font-mono text-[11px] tracking-[.14em] text-slate-500 uppercase lg:block">Sistema · Acceso restringido</p>
      </aside>
      <section className="flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-[0_24px_70px_rgba(15,35,60,.12)] sm:p-10">
          <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /><p className="font-mono text-xs tracking-[.18em] text-slate-500 uppercase">Sesión administrativa</p></div>
          <h1 className="mt-5 text-3xl font-black tracking-[-.035em] text-[#102640]">Identifícate</h1>
          <BackofficeLoginForm />
        </div>
      </section>
    </main>
  );
}
