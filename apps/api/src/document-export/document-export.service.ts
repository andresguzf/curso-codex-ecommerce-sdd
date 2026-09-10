import { Inject, Injectable } from "@nestjs/common";

import type { InvoiceSnapshot } from "../billing-invoicing/invoice.aggregate";
import type { OrderSnapshot } from "../order-management/order.aggregate";
import { invoiceDocumentTemplate, orderDocumentTemplate } from "./document-templates";
import { PDF_RENDERER, type PdfRenderer } from "./pdf-renderer.port";

@Injectable()
export class DocumentExportService {
  constructor(@Inject(PDF_RENDERER) private readonly renderer: PdfRenderer) {}

  renderOrder(order: OrderSnapshot): Buffer {
    return this.renderer.render(orderDocumentTemplate(order));
  }

  renderInvoice(invoice: InvoiceSnapshot): Buffer {
    return this.renderer.render(invoiceDocumentTemplate(invoice));
  }
}
