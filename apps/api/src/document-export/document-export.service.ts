import { createHash } from "node:crypto";

import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";

import type { InvoiceSnapshot } from "../billing-invoicing/invoice.aggregate";
import type { OrderSnapshot } from "../order-management/order.aggregate";
import { ImageStorageService } from "../product-catalog/image-storage/image-storage.service";
import { ImageStorageNotFoundError, ImageStorageValidationError } from "../product-catalog/image-storage/image-storage.port";
import { invoiceDocumentTemplate, orderDocumentTemplate } from "./document-templates";
import { PDF_RENDERER, type PdfRenderer } from "./pdf-renderer.port";

@Injectable()
export class DocumentExportService {
  constructor(
    @Inject(PDF_RENDERER) private readonly renderer: PdfRenderer,
    @Inject(ImageStorageService) private readonly images: ImageStorageService,
  ) {}

  async renderOrder(order: OrderSnapshot): Promise<Buffer> {
    return this.renderer.render({ ...orderDocumentTemplate(order), logo: await this.historicalLogo(order.issuerSnapshot) });
  }

  async renderInvoice(invoice: InvoiceSnapshot): Promise<Buffer> {
    return this.renderer.render({ ...invoiceDocumentTemplate(invoice), logo: await this.historicalLogo(invoice.issuerSnapshot) });
  }

  private async historicalLogo(snapshot: unknown) {
    if (!snapshot || typeof snapshot !== "object" || !("logo" in snapshot)) return undefined;
    const logo = snapshot.logo;
    if (!logo || typeof logo !== "object" || !("sha256" in logo)) return undefined; // pre-managed legacy snapshot
    if (!("storageKey" in logo) || typeof logo.storageKey !== "string"
      || typeof logo.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(logo.sha256)) {
      throw new InternalServerErrorException({ code: "DOCUMENT_LOGO_INVALID", message: "The historical logo reference is invalid" });
    }
    try {
      const image = await this.images.read(logo.storageKey);
      if (createHash("sha256").update(image.data).digest("hex") !== logo.sha256) {
        throw new InternalServerErrorException({ code: "DOCUMENT_LOGO_TAMPERED", message: "The historical logo does not match its snapshot" });
      }
      return { data: image.data, mimeType: image.mimeType };
    } catch (error) {
      if (error instanceof ImageStorageNotFoundError || error instanceof ImageStorageValidationError) {
        throw new InternalServerErrorException({ code: "DOCUMENT_LOGO_MISSING", message: "The historical logo asset is unavailable" });
      }
      throw error;
    }
  }
}
