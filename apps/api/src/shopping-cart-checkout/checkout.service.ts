import { createHash, randomUUID } from "node:crypto";

import {
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import {
  cartItems,
  carts,
  idempotencyRecords,
  orderItems,
  orders,
  payments,
  products,
} from "../database/schema";
import {
  InventoryStockUnavailableError,
} from "../inventory-control/inventory-stock.repository";
import { InventoryStockService } from "../inventory-control/inventory-stock.service";
import { addMoneyAmounts, calculateCartTotals } from "./cart-totals";
import type {
  CheckoutCustomer,
  CheckoutInput,
  CheckoutOrderItem,
  CheckoutResult,
  RejectedCheckoutResult,
} from "./checkout.types";
import { PaymentProcessor } from "./payment/payment.port";
import { ShippingQuoteProvider } from "./shipping/shipping.port";

const CHECKOUT_SCOPE = "CHECKOUT";
const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1_000;

type CheckoutTransactionResult =
  | Readonly<{ outcome: "APPROVED"; response: CheckoutResult }>
  | Readonly<{ outcome: "REJECTED"; response: RejectedCheckoutResult }>;

type CheckoutLine = Readonly<{
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  currency: string;
}>;

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableRequest(input: CheckoutInput): string {
  return JSON.stringify({
    paymentMethod: input.paymentMethod,
    shippingAddress: {
      city: input.shippingAddress.city,
      countryCode: input.shippingAddress.countryCode,
      line1: input.shippingAddress.line1,
      line2: input.shippingAddress.line2 ?? null,
      postalCode: input.shippingAddress.postalCode,
      recipientName: input.shippingAddress.recipientName,
      region: input.shippingAddress.region,
    },
    shippingMethod: input.shippingMethod,
  });
}

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(InventoryStockService)
    private readonly inventory: InventoryStockService,
    @Inject(PaymentProcessor) private readonly payment: PaymentProcessor,
    @Inject(ShippingQuoteProvider)
    private readonly shipping: ShippingQuoteProvider,
  ) {}

  async checkout(
    customer: CheckoutCustomer,
    input: CheckoutInput,
    idempotencyKey: string,
  ): Promise<CheckoutResult> {
    const keyHash = hash(idempotencyKey);
    const requestHash = hash(stableRequest(input));

    const result = await this.database.client.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`checkout:${customer.id}:${keyHash}`}))`,
      );

      const [existing] = await transaction
        .select({
          requestHash: idempotencyRecords.requestHash,
          responseSnapshot: idempotencyRecords.responseSnapshot,
          status: idempotencyRecords.status,
        })
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.customerId, customer.id),
            eq(idempotencyRecords.scope, CHECKOUT_SCOPE),
            eq(idempotencyRecords.keyHash, keyHash),
          ),
        )
        .for("update")
        .limit(1);

      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_REUSED",
            message: "The idempotency key was already used for another checkout request",
          });
        }
        if (existing.responseSnapshot) {
          return existing.responseSnapshot as CheckoutTransactionResult;
        }
        throw new ConflictException({
          code: "CHECKOUT_IN_PROGRESS",
          message: "The checkout request is still being processed",
        });
      }

      const now = new Date();
      const [idempotency] = await transaction
        .insert(idempotencyRecords)
        .values({
          customerId: customer.id,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS),
          keyHash,
          requestHash,
          scope: CHECKOUT_SCOPE,
        })
        .returning({ id: idempotencyRecords.id });
      if (!idempotency) throw new Error("PostgreSQL did not create the idempotency record");

      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`active-cart:${customer.id}`}))`,
      );
      const [cart] = await transaction
        .select({ id: carts.id })
        .from(carts)
        .where(and(eq(carts.customerId, customer.id), eq(carts.status, "ACTIVE")))
        .for("update")
        .limit(1);
      if (!cart) {
        throw new ConflictException({
          code: "CHECKOUT_CART_EMPTY",
          message: "The active cart is empty",
        });
      }

      const cartLines = await transaction
        .select({ productId: cartItems.productId, quantity: cartItems.quantity })
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id))
        .orderBy(asc(cartItems.productId));
      if (cartLines.length === 0) {
        throw new ConflictException({
          code: "CHECKOUT_CART_EMPTY",
          message: "The active cart is empty",
        });
      }

      const lines: CheckoutLine[] = [];
      for (const cartLine of cartLines) {
        const [product] = await transaction
          .select({
            currency: products.currency,
            id: products.id,
            name: products.name,
            price: products.price,
            sku: products.sku,
          })
          .from(products)
          .where(
            and(
              eq(products.id, cartLine.productId),
              eq(products.status, "ACTIVE"),
              isNull(products.deletedAt),
            ),
          )
          .for("share")
          .limit(1);
        if (!product) {
          throw new ConflictException({
            code: "CHECKOUT_PRODUCT_UNAVAILABLE",
            details: { productId: cartLine.productId },
            message: "A cart product is no longer available",
          });
        }
        lines.push({
          ...product,
          productId: product.id,
          quantity: cartLine.quantity,
          unitPrice: product.price,
        });
      }

      const currencies = new Set(lines.map((line) => line.currency));
      if (currencies.size !== 1) {
        throw new ConflictException({
          code: "CHECKOUT_CURRENCY_MISMATCH",
          message: "The cart contains products in different currencies",
        });
      }
      const currency = lines[0]?.currency;
      if (!currency) throw new Error("Checkout currency could not be resolved");

      const cartTotals = calculateCartTotals(lines);
      const shipping = await this.shipping.quote({
        currency,
        destination: {
          countryCode: input.shippingAddress.countryCode,
          postalCode: input.shippingAddress.postalCode,
        },
        method: input.shippingMethod,
      });
      const total = addMoneyAmounts(cartTotals.subtotal, shipping.cost);
      const payment = await this.payment.process({
        amount: total,
        attemptReference: keyHash,
        currency,
        method: input.paymentMethod,
      });

      if (payment.status === "REJECTED") {
        const response: RejectedCheckoutResult = {
          payment: {
            method: payment.method,
            providerReference: payment.providerReference,
            status: "REJECTED",
          },
        };
        const snapshot: CheckoutTransactionResult = {
          outcome: "REJECTED",
          response,
        };
        await transaction
          .update(idempotencyRecords)
          .set({ responseSnapshot: snapshot, status: "FAILED", updatedAt: now })
          .where(eq(idempotencyRecords.id, idempotency.id));
        return snapshot;
      }

      const orderId = randomUUID();
      const orderNumber = `ORD-${orderId.toUpperCase()}`;
      const orderLines: CheckoutOrderItem[] = lines.map((line, index) => ({
        currency,
        lineTotal: cartTotals.lineSubtotals[index] ?? "0.00",
        name: line.name,
        productId: line.productId,
        quantity: line.quantity,
        sku: line.sku,
        taxAmount: "0.00",
        unitPrice: line.unitPrice,
      }));
      const [order] = await transaction
        .insert(orders)
        .values({
          currency,
          customerId: customer.id,
          customerSnapshot: {
            displayName: customer.displayName,
            email: customer.email,
            id: customer.id,
          },
          id: orderId,
          number: orderNumber,
          paymentSnapshot: {
            ...payment.snapshot,
            providerReference: payment.providerReference,
            status: payment.status,
          },
          shippingAddressSnapshot: input.shippingAddress,
          shippingMethodSnapshot: shipping.snapshot,
          shippingTotal: shipping.cost,
          subtotal: cartTotals.subtotal,
          taxTotal: "0.00",
          total,
        })
        .returning({ createdAt: orders.createdAt });
      if (!order) throw new Error("PostgreSQL did not create the order");

      await transaction.insert(orderItems).values(
        orderLines.map((line) => ({
          currency: line.currency,
          lineTotal: line.lineTotal,
          nameSnapshot: line.name,
          orderId,
          productId: line.productId,
          quantity: line.quantity,
          skuSnapshot: line.sku,
          taxAmount: line.taxAmount,
          unitPrice: line.unitPrice,
        })),
      );
      await transaction.insert(payments).values({
        amount: total,
        currency,
        method: payment.method,
        orderId,
        processedAt: now,
        providerReference: payment.providerReference,
        resultSnapshot: payment.snapshot,
        status: "APPROVED",
      });

      try {
        await this.inventory.deductInTransaction(
          transaction,
          lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
          {
            actorUserId: customer.id,
            reason: "Approved checkout",
            referenceId: orderId,
            referenceType: "ORDER",
          },
        );
      } catch (error) {
        if (error instanceof InventoryStockUnavailableError) {
          throw new ConflictException({
            code: "CHECKOUT_INSUFFICIENT_STOCK",
            details: { shortages: error.shortages },
            message: "Inventory changed before checkout could be completed",
          });
        }
        throw error;
      }

      await transaction
        .update(carts)
        .set({ closedAt: now, status: "CHECKED_OUT", updatedAt: now })
        .where(eq(carts.id, cart.id));

      const response: CheckoutResult = {
        order: {
          createdAt: order.createdAt.toISOString(),
          currency,
          id: orderId,
          items: orderLines,
          number: orderNumber,
          shippingTotal: shipping.cost,
          status: "PROCESSING",
          subtotal: cartTotals.subtotal,
          taxTotal: "0.00",
          total,
        },
        payment: {
          method: payment.method,
          providerReference: payment.providerReference,
          status: "APPROVED",
        },
      };
      const snapshot: CheckoutTransactionResult = {
        outcome: "APPROVED",
        response,
      };
      await transaction
        .update(idempotencyRecords)
        .set({
          orderId,
          responseSnapshot: snapshot,
          status: "COMPLETED",
          updatedAt: now,
        })
        .where(eq(idempotencyRecords.id, idempotency.id));

      return snapshot;
    });

    if (result.outcome === "REJECTED") {
      throw new ConflictException({
        code: "PAYMENT_REJECTED",
        details: result.response.payment,
        message: "The simulated payment was rejected",
      });
    }
    return result.response;
  }
}
