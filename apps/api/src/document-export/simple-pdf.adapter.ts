import { deflateSync } from "node:zlib";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import sharp from "sharp";
import type { PdfDocument, PdfRenderer } from "./pdf-renderer.port";

const NAVY = "0.063 0.176 0.314";
const INK = "0.125 0.176 0.235";
const BORDER = "0.82 0.86 0.90";
const COLUMNS = [201, 54, 86, 78, 96];
function printable(value: string): string {
  return value.replace(/[\u2010-\u2014]/g, "-").replace(/[^\x20-\xff\n]/g, "?");
}
function escaped(value: string): string {
  return printable(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function width(value: string, size: number, mono = false): number {
  // Conservative Helvetica advances; Courier is exact. Both use WinAnsi for Spanish.
  return [...printable(value)].reduce((sum, char) => sum + (mono ? .6
    : /[ilI.,:;'!| ]/.test(char) ? .3 : /[MWmw@%]/.test(char) ? .95
      : /[A-ZÁÉÍÓÚÑ]/.test(char) ? .75 : .6), 0) * size;
}
function wrap(value: string, maximum: number, size: number, mono = false): string[] {
  const result: string[] = [];
  for (const paragraph of printable(value).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && width(`${line} ${word}`, size, mono) <= maximum) { line += ` ${word}`; continue; }
      if (line) { result.push(line); line = ""; }
      for (const char of word) {
        if (line && width(line + char, size, mono) > maximum) { result.push(line); line = ""; }
        line += char;
      }
    }
    result.push(line);
  }
  return result.length ? result : [""];
}

/** Deterministic snapshot-only A4 renderer with tables and real pagination. */
@Injectable()
export class SimplePdfAdapter implements PdfRenderer {
  async render(document: PdfDocument): Promise<Buffer> {
    let imageObject: string | undefined;
    let logoWidth = 0;
    let logoHeight = 0;
    if (document.logo) {
      try {
        const { data, info } = await sharp(document.logo.data)
          .resize({ width: 480, height: 160, fit: "inside" })
          .flatten({ background: "#ffffff" }).toColourspace("srgb").raw()
          .toBuffer({ resolveWithObject: true });
        if (info.channels !== 3) throw new Error("Logo must yield RGB data");
        const ratio = Math.min(112 / info.width, 48 / info.height);
        logoWidth = info.width * ratio; logoHeight = info.height * ratio;
        const compressed = deflateSync(data);
        imageObject = `<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n${compressed.toString("latin1")}\nendstream`;
      } catch {
        throw new InternalServerErrorException({ code: "DOCUMENT_LOGO_UNREADABLE", message: "The historical logo cannot be rendered" });
      }
    }
    const pages: string[][] = [];
    let commands: string[] = [];
    let top = 0;
    const text = (value: string, x: number, y: number, size = 10, font = "F1", color = INK) => {
      commands.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${(842 - y).toFixed(2)} Tm (${escaped(value)}) Tj ET`);
    };
    const box = (x: number, y: number, w: number, h: number, color: string) => {
      commands.push(`${color} rg ${x} ${842 - y - h} ${w} ${h} re f`);
    };
    const line = (y: number) => commands.push(`${BORDER} RG .5 w 40 ${842 - y} m 555 ${842 - y} l S`);
    const newPage = () => {
      commands = []; pages.push(commands);
      box(0, 0, 595, 8, NAVY);
      const title = wrap(document.title, 365, 15);
      title.forEach((value, index) => text(value, 40, 48 + index * 19, 15, "F2", NAVY));
      if (imageObject) commands.push(`q ${logoWidth} 0 0 ${logoHeight} ${555 - logoWidth} ${842 - 34 - logoHeight} cm /Logo Do Q`);
      top = Math.max(100, 60 + title.length * 19);
      if (pages.length > 1) { text("Continuación del documento", 40, top, 9); top += 22; }
    };
    const paragraph = (value: string, size = 10, font = "F1", max = 515, x = 40) => {
      for (const fragment of wrap(value, max, size, font === "F3")) {
        if (top + 16 > 775) newPage();
        text(fragment, x, top, size, font); top += 15;
      }
    };
    newPage();
    for (const issuer of document.issuerLines ?? []) paragraph(issuer, 9);
    if (document.issuerLines?.length) { top += 8; line(top); top += 24; }
    for (const value of document.lines) paragraph(value);
    top += 18;
    const tableHeader = () => {
      if (top + 32 > 775) newPage();
      box(40, top, 515, 28, NAVY);
      let x = 40;
      document.table!.headers.forEach((label, index) => {
        text(label, x + 8, top + 18, 8, "F2", "1 1 1"); x += COLUMNS[index] ?? 0;
      });
      top += 28;
    };
    if (document.table) {
      tableHeader();
      document.table.rows.forEach((row, rowIndex) => {
        const cells = row.map((value, index) => wrap(value, (COLUMNS[index] ?? 96) - 16, 8.5, index > 0));
        const count = Math.max(1, ...cells.map((cell) => cell.length));
        let offset = 0;
        while (offset < count) {
          const fullHeight = (count - offset) * 13 + 16;
          // Move ordinary rows together; oversized rows continue without losing text.
          if ((fullHeight <= 620 && top + fullHeight > 775) || top + 29 > 775) { newPage(); tableHeader(); }
          const take = Math.min(count - offset, Math.max(1, Math.floor((775 - top - 16) / 13)));
          const height = take * 13 + 16;
          box(40, top, 515, height, rowIndex % 2 === 0 ? "0.95 0.97 0.99" : "1 1 1");
          let x = 40;
          cells.forEach((cell, index) => {
            const w = COLUMNS[index] ?? 96;
            cell.slice(offset, offset + take).forEach((value, lineIndex) => {
              text(value, index === 0 ? x + 8 : x + w - 8 - width(value, 8.5, true), top + 17 + lineIndex * 13, 8.5, index === 0 ? "F1" : "F3");
            });
            commands.push(`${BORDER} RG .3 w ${x} ${842 - top} m ${x} ${842 - top - height} l S`);
            x += w;
          });
          commands.push(`${BORDER} RG .3 w 555 ${842 - top} m 555 ${842 - top - height} l S`);
          top += height; line(top); offset += take;
        }
      });
    }
    const totals = (document.totals ?? []).flatMap((value) => wrap(value, 255, 10));
    if (top + 36 + totals.length * 22 > 775) newPage();
    top += 24;
    totals.forEach((value, index) => {
      const last = index === totals.length - 1;
      if (last) box(280, top - 14, 275, 30, NAVY);
      text(value, 547 - width(value, 10), top + 5, 10, last ? "F2" : "F1", last ? "1 1 1" : INK);
      top += last ? 38 : 22;
    });
    pages.forEach((page, index) => {
      commands = page; line(798);
      text("Documento basado en snapshots históricos · USD", 40, 818, 8);
      text(`Página ${index + 1} de ${pages.length}`, 468, 818, 8);
    });
    const imageId = imageObject ? 6 : undefined;
    const firstPageId = imageId ? 7 : 6;
    const objects: string[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      `<< /Type /Pages /Kids [${pages.map((_, i) => `${firstPageId + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    ];
    if (imageObject) objects.push(imageObject);
    pages.forEach((page, index) => {
      const pageId = firstPageId + index * 2;
      const stream = page.join("\n") + "\n";
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${imageId ? ` /XObject << /Logo ${imageId} 0 R >>` : ""} >> /Contents ${pageId + 1} 0 R >>`,
        `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`);
    });
    const chunks = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"];
    const offsets: number[] = [0];
    let length = Buffer.byteLength(chunks[0], "latin1");
    objects.forEach((object, index) => {
      offsets.push(length);
      const value = `${index + 1} 0 obj\n${object}\nendobj\n`;
      chunks.push(value); length += Buffer.byteLength(value, "latin1");
    });
    const xrefOffset = length;
    chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    return Buffer.from(chunks.join(""), "latin1");
  }
}
