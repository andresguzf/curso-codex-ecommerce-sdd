"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ConfirmationDialogProps = Readonly<{
  cancelLabel?: string;
  confirmLabel?: string;
  description: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  open: boolean;
  title: string;
}>;

export function ConfirmationDialog({
  cancelLabel = "Cancelar",
  confirmLabel = "Confirmar",
  description,
  isPending = false,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const confirmLockedRef = useRef(false);
  const pendingRef = useRef(isPending);

  useEffect(() => {
    pendingRef.current = isPending;
    if (!isPending) confirmLockedRef.current = false;
  }, [isPending]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const root = document.createElement("div");
    root.dataset.slot = "confirmation-dialog-portal";
    document.body.append(root);
    const siblings = Array.from(document.body.children)
      .filter((element) => element !== root)
      .map((element) => ({ element, wasInert: element.hasAttribute("inert") }));
    for (const { element } of siblings) element.setAttribute("inert", "");
    setPortalRoot(root);
    confirmLockedRef.current = false;

    return () => {
      for (const { element, wasInert } of siblings) {
        if (!wasInert) element.removeAttribute("inert");
      }
      root.remove();
      queueMicrotask(() => {
        if (!dialogRef.current && previouslyFocused?.isConnected) previouslyFocused.focus();
      });
    };
  }, [open]);

  useEffect(() => {
    if (!open || !portalRoot) return;
    if (isPending) dialogRef.current?.focus();
    else cancelButtonRef.current?.focus();
  }, [isPending, open, portalRoot]);

  useEffect(() => {
    if (!open || !portalRoot) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isPending) onCancel();
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const buttons = [cancelButtonRef.current, confirmButtonRef.current]
        .filter((button): button is HTMLButtonElement => button !== null && !button.disabled);
      if (buttons.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = buttons[0]!;
      const last = buttons[buttons.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }

    function keepFocusInside(event: FocusEvent) {
      if (!dialogRef.current?.contains(event.target as Node)) {
        if (isPending) dialogRef.current?.focus();
        else cancelButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", keepFocusInside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", keepFocusInside);
    };
  }, [isPending, onCancel, open, portalRoot]);

  function handleConfirm() {
    if (isPending || confirmLockedRef.current) return;
    confirmLockedRef.current = true;
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        void result.then(
          () => { confirmLockedRef.current = false; },
          () => { confirmLockedRef.current = false; },
        );
      } else {
        window.setTimeout(() => {
          if (!pendingRef.current) confirmLockedRef.current = false;
        }, 0);
      }
    } catch (error) {
      confirmLockedRef.current = false;
      throw error;
    }
  }

  if (!open || !portalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/65 p-4"
      data-slot="confirmation-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onCancel();
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl"
        data-slot="confirmation-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="m-0 text-xl font-bold" id={titleId}>{title}</h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-slate-600" id={descriptionId}>{description}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50"
            disabled={isPending}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className="min-h-11 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            disabled={isPending}
            onClick={handleConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {isPending ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
