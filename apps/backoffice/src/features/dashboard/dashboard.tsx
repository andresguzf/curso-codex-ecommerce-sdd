"use client";

import Link from "next/link";
import type { AuthSession, DashboardSummary } from "@technology-ecommerce/api-schemas";
import { AdminMetricCard } from "../layout/admin-metric-card";
import { DashboardApiError, type DashboardRole } from "./dashboard-api";
import { dashboardCards } from "./dashboard-cards";
import { useDashboardSummary } from "./use-dashboard-summary";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-canvas)]";
const formatDate = (value: string) => new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));

export function Dashboard({ session, role }: Readonly<{ session: AuthSession; role: DashboardRole }>) {
  const summary = useDashboardSummary(session, role);
  const restricted = summary.error instanceof DashboardApiError && [401, 403].includes(summary.error.status);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8" data-slot="dashboard">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--ds-border)] pb-5">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--ds-text-muted)]">Nexo Operations · {role === "ADMIN" ? "Administración" : "Facturación"}</p>
          <h1 className="text-2xl font-semibold text-[var(--ds-text)]">Resumen de la tienda</h1>
          <p className="mt-2 text-sm text-[var(--ds-text-muted)]">{session.user.displayName}, revisa los pendientes y continúa con su gestión.</p>
        </div>
        <button type="button" onClick={() => void summary.refetch()} disabled={summary.isFetching}
          className={`rounded-[var(--ds-radius-control)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text)] disabled:cursor-wait disabled:bg-[var(--ds-disabled)] disabled:text-[var(--ds-disabled-text)] ${focus}`}>
          {summary.isFetching ? "Actualizando…" : "Actualizar resumen"}
        </button>
      </header>
      {summary.isPending ? <p role="status" className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] p-6 text-[var(--ds-text-muted)]">Cargando indicadores de la tienda…</p>
        : summary.isError ? <section role="alert" className="rounded-lg border border-[var(--ds-danger)] bg-[var(--ds-danger-soft)] p-5 text-[var(--ds-text)]">
          <h2 className="font-semibold">No se pudo cargar el resumen</h2>
          <p className="mt-2 text-sm">{summary.error instanceof DashboardApiError ? summary.error.message : "Comprueba tu conexión y vuelve a intentarlo."}</p>
          {restricted ? <Link className={`mt-3 inline-block rounded px-2 py-1 underline ${focus}`} href="/login">Ir a iniciar sesión</Link>
            : <button className={`mt-3 rounded border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2 text-sm ${focus}`} onClick={() => void summary.refetch()}>Reintentar</button>}
        </section>
          : summary.data && summary.data.role === role ? <DashboardContent summary={summary.data} /> : null}
    </main>
  );
}

function DashboardContent({ summary }: Readonly<{ summary: DashboardSummary }>) {
  const cards = dashboardCards(summary);
  const empty = cards.every((card) => card.value === 0);
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--ds-text-muted)]" aria-live="polite">
        <p>Actualizado: <time dateTime={summary.updatedAt}>{formatDate(summary.updatedAt)} UTC</time></p>
        {summary.role === "BILLING" ? <p>Pagos del <time dateTime={summary.period.from}>{formatDate(summary.period.from)}</time> al <time dateTime={summary.period.to}>{formatDate(summary.period.to)}</time> UTC</p> : null}
      </div>
      {empty ? <p role="status" className="mb-5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-subtle)] p-4 text-sm text-[var(--ds-text)]">Todavía no hay actividad para mostrar. Usa los accesos de gestión para comenzar.</p> : null}
      <section aria-labelledby="dashboard-indicators">
        <h2 id="dashboard-indicators" className="mb-3 text-sm font-semibold text-[var(--ds-text)]">Indicadores de gestión</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => <div key={card.label} className="flex min-w-0 flex-col">
            <AdminMetricCard label={card.label} value={card.value} description={card.description} />
            <Link href={card.href} className={`mt-2 self-start rounded px-1 py-1 text-xs font-semibold text-[var(--ds-accent)] underline underline-offset-4 ${focus}`}>{card.action}</Link>
          </div>)}
        </div>
      </section>
      <nav aria-label="Accesos rápidos del dashboard" className="mt-8 border-t border-[var(--ds-border)] pt-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--ds-text)]">Continuar con la gestión</h2>
        <div className="flex flex-wrap gap-3">
          {(summary.role === "ADMIN" ? [
            { href: "/products", label: "Gestionar catálogo" }, { href: "/users", label: "Gestionar usuarios" },
            { href: "/inventory", label: "Gestionar inventario" },
          ] : []).concat([
            { href: "/orders?status=PROCESSING&page=1", label: "Gestionar órdenes" },
            { href: "/invoices", label: "Gestionar facturas" },
          ]).map((link) => <Link key={link.href} href={link.href} className={`rounded-[var(--ds-radius-control)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-3 text-sm font-semibold text-[var(--ds-text)] hover:bg-[var(--ds-surface-subtle)] ${focus}`}>{link.label}</Link>)}
        </div>
      </nav>
      <p className="mt-6 text-xs leading-5 text-[var(--ds-text-muted)]">Los indicadores corresponden a la fecha de actualización. Consulta cada listado para revisar el estado actual antes de realizar cambios.</p>
    </>
  );
}
