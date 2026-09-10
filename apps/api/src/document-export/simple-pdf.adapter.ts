import { Injectable } from "@nestjs/common";

import type { PdfDocument, PdfRenderer } from "./pdf-renderer.port";

function printable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\r\n\t]/g, " ")
    .trim();
}

function escapePdfText(value: string): string {
  return printable(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Small dependency-free PDF renderer; a future object-storage/worker adapter can implement the same port. */
@Injectable()
export class SimplePdfAdapter implements PdfRenderer {
  render(document: PdfDocument): Buffer {
    const lines = [document.title, ...document.lines]
      .map(printable)
      .filter(Boolean)
      .slice(0, 46);
    const commands = ["BT", "/F1 11 Tf", "50 790 Td"];
    lines.forEach((line, index) => {
      if (index > 0) commands.push("0 -16 Td");
      commands.push(`(${escapePdfText(line)}) Tj`);
    });
    commands.push("ET");
    const stream = `${commands.join("\n")}\n`;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
    ];
    const chunks = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
    const offsets: number[] = [0];
    let length = Buffer.byteLength(chunks[0], "latin1");
    objects.forEach((object, index) => {
      offsets.push(length);
      const value = `${index + 1} 0 obj\n${object}\nendobj\n`;
      chunks.push(value);
      length += Buffer.byteLength(value, "latin1");
    });
    const xrefOffset = length;
    const xref = [`xref`, `0 ${objects.length + 1}`, "0000000000 65535 f "];
    offsets.slice(1).forEach((offset) => xref.push(`${String(offset).padStart(10, "0")} 00000 n `));
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(`${xref.join("\n")}\n${trailer}`);
    return Buffer.from(chunks.join(""), "latin1");
  }
}
