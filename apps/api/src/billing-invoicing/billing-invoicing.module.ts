import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module";
import { InvoiceFromOrderController } from "./invoice-from-order.controller";
import { InvoiceFromOrderService } from "./invoice-from-order.service";
import { InvoiceLifecycleService } from "./invoice-lifecycle.service";

@Module({
  imports: [AuthModule],
  controllers: [InvoiceFromOrderController],
  providers: [InvoiceFromOrderService, InvoiceLifecycleService],
  exports: [InvoiceFromOrderService, InvoiceLifecycleService],
})
export class BillingInvoicingModule {}
