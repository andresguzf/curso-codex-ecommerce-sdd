"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A controlled, accessible filter panel that enters from the left.
 *
 * The drawer owns only transient presentation state. Filter values remain in
 * the consuming route (usually the URL), so closing the panel never discards
 * or duplicates server state.
 */
export function FilterDrawer({
  children,
  id,
  onClose,
  open,
  side = "left",
  title,
}: Readonly<{
  children: React.ReactNode;
  id?: string;
  onClose: () => void;
  open: boolean;
  side?: "left" | "right";
  title: string;
}>) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = document.createElement("div");
    root.dataset.slot = "filter-drawer-portal";
    document.body.append(root);
    setPortalRoot(root);
    return () => root.remove();
  }, []);

  useEffect(() => {
    if (!open || !portalRoot) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const siblings = Array.from(document.body.children)
      .filter((element) => element !== portalRoot)
      .map((element) => ({ element, wasInert: element.hasAttribute("inert") }));
    for (const { element } of siblings) element.setAttribute("inert", "");

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (!first || !last) return;

      if (!panelRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    function keepFocusInside(event: FocusEvent) {
      if (!panelRef.current?.contains(event.target as Node)) closeButtonRef.current?.focus();
    }
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", keepFocusInside);
      document.body.style.overflow = previousOverflow;
      for (const { element, wasInert } of siblings) {
        if (!wasInert) element.removeAttribute("inert");
      }
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose, open, portalRoot]);

  if (!portalRoot) return null;

  return createPortal(
    <div
      aria-hidden={!open}
      className={open ? "fixed inset-0 z-[60]" : "hidden"}
      data-slot="filter-drawer"
      inert={!open}
    >
      <button
        aria-label="Cerrar panel de filtros"
        className="absolute inset-0 bg-slate-950/60"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`absolute inset-y-0 ${side === "right" ? "right-0 border-l" : "left-0 border-r"} flex w-[min(100%,24rem)] translate-x-0 flex-col border-slate-200 bg-white text-slate-950 shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none`}
        data-state={open ? "open" : "closed"}
        id={id}
        ref={panelRef}
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
      </div>
    </div>,
    portalRoot,
  );
}
