import { describe, expect, it } from "vitest";

import { createPdfDownload, PdfDownloadError } from "../src/pdf-download";

describe("PDF download helpers", () => {
  it("accepts a PDF response and its safe server filename", () => {
    const response = new Response("pdf", { status: 200, headers: { "content-type": "application/pdf; charset=binary", "content-disposition": 'attachment; filename="order-123.pdf"' } });
    const result = createPdfDownload(response, new Blob(["pdf"], { type: "application/pdf" }), "fallback.pdf");
    expect(result.filename).toBe("order-123.pdf");
    expect(result.blob.type).toBe("application/pdf");
  });

  it("uses a fallback for unsafe or missing filenames", () => {
    const response = new Response("pdf", { status: 200, headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="../private.txt"' } });
    expect(createPdfDownload(response, new Blob(["pdf"], { type: "application/pdf" }), "invoice-fallback.pdf").filename).toBe("invoice-fallback.pdf");
  });

  it("rejects non-PDF and empty responses", () => {
    const response = new Response("not pdf", { status: 200, headers: { "content-type": "text/plain" } });
    expect(() => createPdfDownload(response, new Blob(["not pdf"], { type: "text/plain" }), "fallback.pdf")).toThrow(PdfDownloadError);
    const emptyPdf = new Response(null, { status: 200, headers: { "content-type": "application/pdf" } });
    expect(() => createPdfDownload(emptyPdf, new Blob([], { type: "application/pdf" }), "fallback.pdf")).toThrow(PdfDownloadError);
  });
});
