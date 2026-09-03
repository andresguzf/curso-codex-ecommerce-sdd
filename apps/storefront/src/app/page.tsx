import { SessionControls } from "@/features/auth/session-controls";

export default function StorefrontHomePage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <section className="max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          Storefront
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          E-commerce de tecnología
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          Aplicación pública inicializada con Next.js, TypeScript, App Router y
          Tailwind CSS.
        </p>
        <div className="mt-8"><SessionControls /></div>
      </section>
    </main>
  );
}
