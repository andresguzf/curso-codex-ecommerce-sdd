"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Inline panel for dense workspaces. It stays beside the main content and
 * collapses by width, so the table gains the released horizontal space.
 */
export function CollapsibleSidePanel({
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
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  return (
    <aside
      aria-hidden={!open}
      aria-labelledby={titleId}
      className={`shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "w-[min(100%,19rem)] opacity-100" : "pointer-events-none w-0 opacity-0"}`}
      data-open={open}
      data-slot="collapsible-side-panel"
      inert={!open}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="m-0 text-base font-black" id={titleId}>{title}</h2>
        <div className="mt-5">{children}</div>
      </div>
    </aside>
  );
}
