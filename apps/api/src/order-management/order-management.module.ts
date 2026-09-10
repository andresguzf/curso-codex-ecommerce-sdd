import { Module } from "@nestjs/common";

import { OrderService } from "./order.service";
import { AuthModule } from "../identity-access/auth.module";
import { CustomerOrdersController } from "./customer-orders.controller";
import { CustomerOrdersService } from "./customer-orders.service";
import { OrderAdministrationService } from "./order-administration.service";
import { OrderCancellationService } from "./order-cancellation.service";
import { InventoryControlModule } from "../inventory-control/inventory-control.module";
import { DocumentExportModule } from "../document-export/document-export.module";

@Module({ imports: [AuthModule, InventoryControlModule, DocumentExportModule], controllers: [CustomerOrdersController], providers: [OrderService, CustomerOrdersService, OrderAdministrationService, OrderCancellationService], exports: [OrderService] })
export class OrderManagementModule {}
