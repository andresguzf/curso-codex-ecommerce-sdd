"use client";

import { savePdfDownload, type PdfDownload } from "@technology-ecommerce/api-client";
import { useState } from "react";

type PdfDownloadButtonProps = Readonly<{
  onDownload: () => Promise<PdfDownload>;
}>;

export function PdfDownloadButton({ onDownload }: PdfDownloadButtonProps) {
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>();

  async function download() {
    if (state === "pending") return;
    setState("pending");
    setMessage(undefined);
    try {
      savePdfDownload(await onDownload());
      setState("success");
      setMessage("PDF descargado correctamente.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudo descargar el PDF. Inténtalo nuevamente.");
    }
  }

  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" onClick={() => { void download(); }} disabled={state === "pending"} aria-busy={state === "pending"} className="inline-flex min-h-11 items-center rounded-xl border border-blue-700 px-5 font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60">
      {state === "pending" ? "Preparando PDF…" : "Descargar PDF"}
    </button>
    {message ? <p role={state === "error" ? "alert" : "status"} className={state === "error" ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-emerald-700"}>{message}</p> : null}
  </div>;
}
