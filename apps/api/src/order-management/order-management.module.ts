import { Module } from "@nestjs/common";
import { OrderSummaryReader } from "./order-summary.reader";

import { OrderService } from "./order.service";
import { AuthModule } from "../identity-access/auth.module";
import { CustomerOrdersController } from "./customer-orders.controller";
import { CustomerOrdersService } from "./customer-orders.service";
import { OrderAdministrationService } from "./order-administration.service";
import { OrderCancellationService } from "./order-cancellation.service";
import { InventoryControlModule } from "../inventory-control/inventory-control.module";
import { DocumentExportModule } from "../document-export/document-export.module";

@Module({ imports: [AuthModule, InventoryControlModule, DocumentExportModule], controllers: [CustomerOrdersController], providers: [OrderSummaryReader, OrderService, CustomerOrdersService, OrderAdministrationService, OrderCancellationService], exports: [OrderService, OrderSummaryReader] })
export class OrderManagementModule {}
