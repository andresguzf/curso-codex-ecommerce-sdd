import type { ReactNode } from "react";

/** A presentational indicator: the caller supplies authorized REST data. */
export function AdminMetricCard({ label, value, description }: Readonly<{
  label: string;
  value: ReactNode;
  description?: string;
}>) {
  return (
    <dl aria-label={label} className="m-0 min-w-0 rounded-[var(--ds-radius-panel)] border border-[var(--ds-border)] bg-[var(--ds-surface)] px-5 py-4 shadow-[var(--ds-elevation)]" data-slot="metric-card">
      <dt className="text-xs font-semibold text-[var(--ds-text-muted)]">{label}</dt>
      <dd className="m-0 mt-1 text-3xl font-semibold tabular-nums text-[var(--ds-text)]">{value}</dd>
      {description ? <dd className="m-0 mt-1 text-xs text-[var(--ds-text-muted)]">{description}</dd> : null}
    </dl>
  );
}
