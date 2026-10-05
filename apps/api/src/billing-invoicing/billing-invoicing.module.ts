import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module.js";
import { BillingSummaryReader } from "./billing-summary.reader.js";
import { InvoiceFromOrderController } from "./invoice-from-order.controller.js";
import { InvoiceFromOrderService } from "./invoice-from-order.service.js";
import { InvoiceController } from "./invoice.controller.js";
import { InvoiceLifecycleService } from "./invoice-lifecycle.service.js";
import { InvoiceQueryService } from "./invoice-query.service.js";
import { ManualInvoiceController } from "./manual-invoice.controller.js";
import { ManualInvoiceService } from "./manual-invoice.service.js";
import { StoreProfileController } from "./store-profile.controller.js";
import { StoreProfileService } from "./store-profile.service.js";
import { DocumentExportModule } from "../document-export/document-export.module.js";
import { ImageStorageModule } from "../product-catalog/image-storage/image-storage.module.js";

@Module({
  imports: [AuthModule, DocumentExportModule, ImageStorageModule],
  controllers: [InvoiceFromOrderController, InvoiceController, ManualInvoiceController, StoreProfileController],
  providers: [
    BillingSummaryReader,
    InvoiceFromOrderService,
    InvoiceLifecycleService,
    InvoiceQueryService,
    ManualInvoiceService,
    StoreProfileService,
  ],
  exports: [
    BillingSummaryReader,
    InvoiceFromOrderService,
    InvoiceLifecycleService,
    InvoiceQueryService,
    ManualInvoiceService,
    StoreProfileService,
  ],
})
export class BillingInvoicingModule {}
