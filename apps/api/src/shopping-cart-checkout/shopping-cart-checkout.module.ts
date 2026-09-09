import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module";
import { InventoryControlModule } from "../inventory-control/inventory-control.module";
import { OrderManagementModule } from "../order-management/order-management.module";
import { CartController } from "./cart.controller";
import { AnonymousCartCookieService } from "./anonymous-cart-cookie.service";
import { AnonymousCartCleanupService } from "./anonymous-cart-cleanup.service";
import { CartRepository } from "./cart.repository";
import { CartService } from "./cart.service";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { PaymentProcessor } from "./payment/payment.port";
import { SimulatedPaymentAdapter } from "./payment/simulated-payment.adapter";
import { ShippingQuoteProvider } from "./shipping/shipping.port";
import { SimulatedShippingAdapter } from "./shipping/simulated-shipping.adapter";

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
