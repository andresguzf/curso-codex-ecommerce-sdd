export type PdfDocument = Readonly<{
  title: string;
  issuerLines?: readonly string[];
  lines: readonly string[];
  logo?: Readonly<{ data: Buffer; mimeType: "image/png" | "image/jpeg" | "image/webp" }>;
}>;

export const PDF_RENDERER = Symbol("PDF_RENDERER");

export interface PdfRenderer {
  render(document: PdfDocument): Promise<Buffer>;
}
