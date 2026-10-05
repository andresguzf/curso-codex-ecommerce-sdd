export type PdfDocument = Readonly<{
  title: string;
  issuerLines?: readonly string[];
  lines: readonly string[];
  table?: Readonly<{ headers: readonly string[]; rows: readonly (readonly string[])[] }>;
  totals?: readonly string[];
  logo?: Readonly<{ data: Buffer; mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml" }>;
}>;

export const PDF_RENDERER = Symbol("PDF_RENDERER");

export interface PdfRenderer {
  render(document: PdfDocument): Promise<Buffer>;
}
