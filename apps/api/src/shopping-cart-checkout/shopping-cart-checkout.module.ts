import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module.js";
import { InventoryControlModule } from "../inventory-control/inventory-control.module.js";
import { OrderManagementModule } from "../order-management/order-management.module.js";
import { CartController } from "./cart.controller.js";
import { AnonymousCartCookieService } from "./anonymous-cart-cookie.service.js";
import { AnonymousCartCleanupService } from "./anonymous-cart-cleanup.service.js";
import { CartRepository } from "./cart.repository.js";
import { CartService } from "./cart.service.js";
import { CheckoutController } from "./checkout.controller.js";
import { CheckoutService } from "./checkout.service.js";
import { PaymentProcessor } from "./payment/payment.port.js";
import { SimulatedPaymentAdapter } from "./payment/simulated-payment.adapter.js";
import { ShippingQuoteProvider } from "./shipping/shipping.port.js";
import { SimulatedShippingAdapter } from "./shipping/simulated-shipping.adapter.js";

@Module({
  controllers: [CartController, CheckoutController],
  imports: [AuthModule, InventoryControlModule, OrderManagementModule],
  providers: [
    AnonymousCartCleanupService,
    AnonymousCartCookieService,
    CartRepository,
    CartService,
    CheckoutService,
    SimulatedPaymentAdapter,
    { provide: PaymentProcessor, useExisting: SimulatedPaymentAdapter },
    SimulatedShippingAdapter,
    { provide: ShippingQuoteProvider, useExisting: SimulatedShippingAdapter },
  ],
  exports: [
    AnonymousCartCleanupService,
    CartService,
    PaymentProcessor,
    ShippingQuoteProvider,
  ],
})
export class ShoppingCartCheckoutModule {}
