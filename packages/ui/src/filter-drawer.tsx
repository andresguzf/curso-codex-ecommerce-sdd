"use client";

import { useEffect, useId, useRef } from "react";

/**
 * A controlled, accessible filter panel that enters from the left.
 *
 * The drawer owns only transient presentation state. Filter values remain in
 * the consuming route (usually the URL), so closing the panel never discards
 * or duplicates server state.
 */
export function FilterDrawer({
  children,
  onClose,
  open,
  title,
}: Readonly<{
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}>) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  return (
    <div
      aria-hidden={!open}
      className={open ? "fixed inset-0 z-40" : "hidden"}
      data-slot="filter-drawer"
    >
      <button
        aria-label="Cerrar panel de filtros"
        className="absolute inset-0 bg-slate-950/60"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="absolute inset-y-0 left-0 flex w-[min(100%,24rem)] translate-x-0 flex-col border-r border-slate-200 bg-white text-slate-950 shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none"
        data-state={open ? "open" : "closed"}
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 className="m-0 text-lg font-black" id={titleId}>{title}</h2>
          <button
            className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Cerrar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}
