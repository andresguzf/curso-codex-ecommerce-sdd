import { Module } from "@nestjs/common";

import { InvoiceLifecycleService } from "./invoice-lifecycle.service";

@Module({
  providers: [InvoiceLifecycleService],
  exports: [InvoiceLifecycleService],
})
export class BillingInvoicingModule {}
