import { deflateSync } from "node:zlib";

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import sharp from "sharp";

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
  async render(document: PdfDocument): Promise<Buffer> {
    const issuerLines = (document.issuerLines ?? []).map(printable).filter(Boolean).slice(0, 4);
    const lines = [document.title, ...document.lines]
      .map(printable)
      .filter(Boolean)
      .slice(0, issuerLines.length ? 40 : 46);
    const commands: string[] = [];
    if (issuerLines.length) {
      commands.push("BT", "/F1 10 Tf", "50 790 Td");
      issuerLines.forEach((line, index) => {
        if (index > 0) commands.push("0 -15 Td");
        commands.push(`(${escapePdfText(line.slice(0, 67))}) Tj`);
      });
      commands.push("ET");
    }
    const bodyStart = issuerLines.length || document.logo ? 690 : 790;
    commands.push("BT", "/F1 11 Tf", `50 ${bodyStart} Td`);
    lines.forEach((line, index) => {
      if (index > 0) commands.push("0 -16 Td");
      commands.push(`(${escapePdfText(line)}) Tj`);
    });
    commands.push("ET");
    let imageObject: string | undefined;
    if (document.logo) {
      let raster: Awaited<ReturnType<ReturnType<typeof sharp>["toBuffer"]>>;
      try {
        raster = await sharp(document.logo.data)
          .resize({ width: 400, height: 240, fit: "inside", withoutEnlargement: true })
          .flatten({ background: "#ffffff" })
          .toColourspace("srgb")
          .raw()
          .toBuffer({ resolveWithObject: true });
      } catch {
        throw new InternalServerErrorException({ code: "DOCUMENT_LOGO_UNREADABLE", message: "The historical logo cannot be rendered" });
      }
      const { data, info } = raster;
      if (info.channels !== 3) throw new Error("Logo raster conversion must yield RGB data");
      const ratio = Math.min(110 / info.width, 66 / info.height);
      const width = Math.round(info.width * ratio);
      const height = Math.round(info.height * ratio);
      commands.unshift(`q ${width} 0 0 ${height} ${502 - width} ${790 - height} cm /Logo Do Q`);
      const compressed = deflateSync(data);
      imageObject = `<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n${compressed.toString("latin1")}\nendstream`;
    }
    const stream = `${commands.join("\n")}\n`;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >>${imageObject ? " /XObject << /Logo 6 0 R >>" : ""} >> /Contents 5 0 R >>`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
    ];
    if (imageObject) objects.push(imageObject);
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
