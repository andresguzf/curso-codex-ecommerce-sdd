export type PdfDownload = Readonly<{
  blob: Blob;
  filename: string;
}>;

export class PdfDownloadError extends Error {
  constructor(message = "La respuesta del documento no es un PDF válido.") {
    super(message);
    this.name = "PdfDownloadError";
  }
}

export function createPdfDownload(response: Response, blob: Blob, fallbackFilename: string): PdfDownload {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/pdf" || blob.size === 0) throw new PdfDownloadError();
  return { blob, filename: safeFilename(response.headers.get("content-disposition"), fallbackFilename) };
}

function safeFilename(contentDisposition: string | null, fallback: string): string {
  const match = contentDisposition?.match(/filename="([^"]+)"/i) ?? contentDisposition?.match(/filename=([^;\s]+)/i);
  const candidate = match?.[1]?.trim().replace(/[\\/\r\n]/g, "");
  return candidate && candidate.toLowerCase().endsWith(".pdf") ? candidate : fallback;
}

export function savePdfDownload(download: PdfDownload): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new PdfDownloadError("La descarga de documentos no está disponible en este entorno.");
  }
  const objectUrl = URL.createObjectURL(download.blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = download.filename;
  link.rel = "noopener";
  link.click();
  globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
