"use client";

import { savePdfDownload, type PdfDownload } from "@technology-ecommerce/api-client";
import { IconButton } from "@technology-ecommerce/ui";
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
    <IconButton
      busy={state === "pending"}
      className="border-blue-700 text-blue-800 hover:bg-blue-50 focus-visible:ring-blue-700"
      disabled={state === "pending"}
      icon="download"
      label={state === "pending" ? "Preparando PDF…" : "Descargar PDF"}
      onClick={() => { void download(); }}
    />
    {message ? <p role={state === "error" ? "alert" : "status"} className={state === "error" ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-emerald-700"}>{message}</p> : null}
  </div>;
}
