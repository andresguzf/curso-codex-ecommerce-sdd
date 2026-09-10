export type PdfDocument = Readonly<{
  title: string;
  lines: readonly string[];
}>;

export const PDF_RENDERER = Symbol("PDF_RENDERER");

export interface PdfRenderer {
  render(document: PdfDocument): Buffer;
}
