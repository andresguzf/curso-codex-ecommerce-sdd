import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module";
import { BillingSummaryReader } from "./billing-summary.reader";
import { InvoiceFromOrderController } from "./invoice-from-order.controller";
import { InvoiceFromOrderService } from "./invoice-from-order.service";
import { InvoiceController } from "./invoice.controller";
import { InvoiceLifecycleService } from "./invoice-lifecycle.service";
import { InvoiceQueryService } from "./invoice-query.service";
import { ManualInvoiceController } from "./manual-invoice.controller";
import { ManualInvoiceService } from "./manual-invoice.service";
import { StoreProfileController } from "./store-profile.controller";
import { StoreProfileService } from "./store-profile.service";
import { StoreLogoService } from "./store-logo.service";
import { DocumentExportModule } from "../document-export/document-export.module";
import { ImageStorageModule } from "../product-catalog/image-storage/image-storage.module";

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
    StoreLogoService,
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
