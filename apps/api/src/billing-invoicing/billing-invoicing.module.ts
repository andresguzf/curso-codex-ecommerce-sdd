import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module";
import { InvoiceFromOrderController } from "./invoice-from-order.controller";
import { InvoiceFromOrderService } from "./invoice-from-order.service";
import { InvoiceController } from "./invoice.controller";
import { InvoiceLifecycleService } from "./invoice-lifecycle.service";
import { InvoiceQueryService } from "./invoice-query.service";
import { ManualInvoiceController } from "./manual-invoice.controller";
import { ManualInvoiceService } from "./manual-invoice.service";
import { DocumentExportModule } from "../document-export/document-export.module";

@Module({
  imports: [AuthModule, DocumentExportModule],
  controllers: [InvoiceFromOrderController, InvoiceController, ManualInvoiceController],
  providers: [
    InvoiceFromOrderService,
    InvoiceLifecycleService,
    InvoiceQueryService,
    ManualInvoiceService,
  ],
  exports: [
    InvoiceFromOrderService,
    InvoiceLifecycleService,
    InvoiceQueryService,
    ManualInvoiceService,
  ],
})
export class BillingInvoicingModule {}
