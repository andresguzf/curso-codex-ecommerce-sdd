import type { ReactNode } from "react";

import { classNames } from "./class-names";

export function LoadingState({
  className,
  message = "Cargando…",
}: Readonly<{ className?: string; message?: string }>) {
  return (
    <div
      aria-live="polite"
      className={classNames("flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-700", className)}
      data-slot="loading-state"
      role="status"
    >
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-700 motion-reduce:animate-none" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({
  action,
  className,
  message,
  title = "No se pudo cargar la información",
}: Readonly<{
  action?: ReactNode;
  className?: string;
  message: string;
  title?: string;
}>) {
  return (
    <div
      className={classNames("rounded-xl border border-red-200 bg-red-50 p-4 text-red-950", className)}
      data-slot="error-state"
      role="alert"
    >
      <p className="m-0 font-bold">{title}</p>
      <p className="mb-0 mt-1 text-sm">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
