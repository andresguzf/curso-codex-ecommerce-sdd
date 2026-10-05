import { Module } from "@nestjs/common";
import { OrderSummaryReader } from "./order-summary.reader.js";

import { OrderService } from "./order.service.js";
import { AuthModule } from "../identity-access/auth.module.js";
import { CustomerOrdersController } from "./customer-orders.controller.js";
import { CustomerOrdersService } from "./customer-orders.service.js";
import { OrderAdministrationService } from "./order-administration.service.js";
import { OrderCancellationService } from "./order-cancellation.service.js";
import { InventoryControlModule } from "../inventory-control/inventory-control.module.js";
import { DocumentExportModule } from "../document-export/document-export.module.js";

@Module({ imports: [AuthModule, InventoryControlModule, DocumentExportModule], controllers: [CustomerOrdersController], providers: [OrderSummaryReader, OrderService, CustomerOrdersService, OrderAdministrationService, OrderCancellationService], exports: [OrderService, OrderSummaryReader] })
export class OrderManagementModule {}
