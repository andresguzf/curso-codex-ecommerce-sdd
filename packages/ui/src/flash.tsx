"use client";

import { useEffect } from "react";
import { create } from "zustand";

export type FlashTone = "success" | "error" | "warning" | "info";

export type FlashMessage = Readonly<{
  tone: FlashTone;
  message: string;
}>;

type FlashState = Readonly<{
  flash: FlashMessage | null;
  dismissFlash: () => void;
  showFlash: (tone: FlashTone, message: string) => void;
}>;

export const useFlashStore = create<FlashState>((set) => ({
  flash: null,
  dismissFlash: () => set({ flash: null }),
  showFlash: (tone, message) => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return;

    set((state) =>
      state.flash?.tone === tone && state.flash.message === normalizedMessage
        ? state
        : { flash: { tone, message: normalizedMessage } },
    );
  },
}));

const tonePresentation: Record<FlashTone, Readonly<{ accent: string; label: string; labelColor: string }>> = {
  success: { accent: "bg-emerald-500", label: "Hecho", labelColor: "text-emerald-800" },
  error: { accent: "bg-rose-600", label: "Error", labelColor: "text-rose-800" },
  warning: { accent: "bg-amber-500", label: "Atención", labelColor: "text-amber-900" },
  info: { accent: "bg-sky-500", label: "Información", labelColor: "text-blue-800" },
};

export function FlashRegion({ appearance }: Readonly<{ appearance: "storefront" | "backoffice" }>) {
  const flash = useFlashStore((state) => state.flash);
  const dismissFlash = useFlashStore((state) => state.dismissFlash);

  useEffect(() => {
    if (!flash || flash.tone === "error" || flash.tone === "warning") return;

    const timeout = window.setTimeout(() => {
      useFlashStore.setState((state) => state.flash === flash ? { flash: null } : state);
    }, 6_000);

    return () => window.clearTimeout(timeout);
  }, [flash]);

  const urgent = flash?.tone === "error" || flash?.tone === "warning";

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[70] sm:left-auto sm:right-6 sm:w-full sm:max-w-md" data-slot="flash-region">
      <div aria-atomic="true" aria-live="polite">
        {flash && !urgent ? (
          <FlashCard appearance={appearance} flash={flash} onDismiss={dismissFlash} />
        ) : null}
      </div>
      <div aria-atomic="true" aria-live="assertive">
        {flash && urgent ? (
          <FlashCard appearance={appearance} flash={flash} onDismiss={dismissFlash} />
        ) : null}
      </div>
    </div>
  );
}

function FlashCard({
  appearance,
  flash,
  onDismiss,
}: Readonly<{
  appearance: "storefront" | "backoffice";
  flash: FlashMessage;
  onDismiss: () => void;
}>) {
  const presentation = tonePresentation[flash.tone];

  return (
    <div
      className={`pointer-events-auto flex overflow-hidden border border-slate-200 bg-white text-slate-950 shadow-[0_18px_48px_-18px_rgba(15,23,42,0.42)] ${appearance === "storefront" ? "rounded-2xl" : "rounded-lg"}`}
      data-slot="flash-message"
      data-tone={flash.tone}
    >
      <span aria-hidden="true" className={`w-1.5 shrink-0 ${presentation.accent}`} />
      <div className="min-w-0 flex-1 px-4 py-3">
        <p className={`m-0 text-xs font-black uppercase tracking-[0.12em] ${presentation.labelColor}`}>{presentation.label}</p>
        <p className="m-0 mt-1 break-words text-sm font-medium leading-5">{flash.message}</p>
      </div>
      <button
        aria-label="Cerrar aviso"
        className="mr-2 mt-2 grid size-9 shrink-0 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        onClick={onDismiss}
        type="button"
      >
        <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
          <path d="m5 5 14 14M19 5 5 19" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}
