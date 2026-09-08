import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import {
  cartItems,
  carts,
  inventoryBalances,
  productImages,
  products,
} from "../database/schema";
import { calculateCartTotals } from "./cart-totals";
import type { ActiveCart } from "./cart.types";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

type CartTransaction = Parameters<
  Parameters<DatabaseService["client"]["transaction"]>[0]
>[0];

type ActiveCartRow = Readonly<{
  id: string;
  customerId: string;
  status: "ACTIVE";
  createdAt: Date;
  updatedAt: Date;
}>;

export class CartItemNotFoundError extends Error {
  constructor() {
    super("The cart item does not exist in the customer's active cart");
    this.name = "CartItemNotFoundError";
  }
}

export class CartProductUnavailableError extends Error {
  constructor(readonly productId: string) {
    super("The product is not available for purchase");
    this.name = "CartProductUnavailableError";
  }
}

export class CartInsufficientStockError extends Error {
  constructor(
    readonly productId: string,
    readonly requestedQuantity: number,
    readonly availableQuantity: number,
  ) {
    super("The requested cart quantity exceeds available inventory");
    this.name = "CartInsufficientStockError";
  }
}

export class CartCurrencyMismatchError extends Error {
  constructor(
    readonly cartCurrency: string,
    readonly productCurrency: string,
  ) {
    super("A cart cannot contain products in different currencies");
    this.name = "CartCurrencyMismatchError";
  }
}

@Injectable()
export class CartRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async getOrCreateActive(customerId: string): Promise<ActiveCart> {
    const cart = await this.database.client.transaction(async (transaction) => {
      await this.lockCustomerCart(transaction, customerId);
      return this.findOrCreateActiveCart(transaction, customerId);
    });

    return this.readCart(cart);
  }

  async addItem(
    customerId: string,
    productId: string,
    quantity: number,
  ): Promise<ActiveCart> {
    const cart = await this.database.client.transaction(async (transaction) => {
      await this.lockCustomerCart(transaction, customerId);
      const activeCart = await this.findOrCreateActiveCart(
        transaction,
        customerId,
      );
      const [currentItem] = await transaction
        .select({ quantity: cartItems.quantity })
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, activeCart.id),
            eq(cartItems.productId, productId),
          ),
        )
        .for("update")
        .limit(1);
      const requestedQuantity = (currentItem?.quantity ?? 0) + quantity;
      const product = await this.requireAvailableProduct(
        transaction,
        productId,
      );
      await this.assertCartCurrency(
        transaction,
        activeCart.id,
        product.currency,
      );
      this.assertStock(
        productId,
        requestedQuantity,
        product.availableQuantity,
      );

      const now = new Date();
      if (currentItem) {
        await transaction
          .update(cartItems)
          .set({ quantity: requestedQuantity, updatedAt: now })
          .where(
            and(
              eq(cartItems.cartId, activeCart.id),
              eq(cartItems.productId, productId),
            ),
          );
      } else {
        await transaction.insert(cartItems).values({
          cartId: activeCart.id,
          productId,
          quantity,
        });
      }

      const [updatedCart] = await transaction
        .update(carts)
        .set({ updatedAt: now })
        .where(eq(carts.id, activeCart.id))
        .returning({
          createdAt: carts.createdAt,
          customerId: carts.customerId,
          id: carts.id,
          status: carts.status,
          updatedAt: carts.updatedAt,
        });

      return this.requireActiveCartRow(updatedCart);
    });

    return this.readCart(cart);
  }

  async updateItem(
    customerId: string,
    itemId: string,
    quantity: number,
  ): Promise<ActiveCart> {
    const cart = await this.database.client.transaction(async (transaction) => {
      await this.lockCustomerCart(transaction, customerId);
      const activeCart = await this.findActiveCart(transaction, customerId);
      if (!activeCart) throw new CartItemNotFoundError();

      const [item] = await transaction
        .select({ id: cartItems.id, productId: cartItems.productId })
        .from(cartItems)
        .where(
          and(eq(cartItems.id, itemId), eq(cartItems.cartId, activeCart.id)),
        )
        .for("update")
        .limit(1);
      if (!item) throw new CartItemNotFoundError();

      const product = await this.requireAvailableProduct(
        transaction,
        item.productId,
      );
      this.assertStock(item.productId, quantity, product.availableQuantity);

      const now = new Date();
      await transaction
        .update(cartItems)
        .set({ quantity, updatedAt: now })
        .where(eq(cartItems.id, item.id));
      const [updatedCart] = await transaction
        .update(carts)
        .set({ updatedAt: now })
        .where(eq(carts.id, activeCart.id))
        .returning({
          createdAt: carts.createdAt,
          customerId: carts.customerId,
          id: carts.id,
          status: carts.status,
          updatedAt: carts.updatedAt,
        });

      return this.requireActiveCartRow(updatedCart);
    });

    return this.readCart(cart);
  }

  async removeItem(customerId: string, itemId: string): Promise<ActiveCart> {
    const cart = await this.database.client.transaction(async (transaction) => {
      await this.lockCustomerCart(transaction, customerId);
      const activeCart = await this.findActiveCart(transaction, customerId);
      if (!activeCart) throw new CartItemNotFoundError();

      const [removed] = await transaction
        .delete(cartItems)
        .where(
          and(eq(cartItems.id, itemId), eq(cartItems.cartId, activeCart.id)),
        )
        .returning({ id: cartItems.id });
      if (!removed) throw new CartItemNotFoundError();

      const [updatedCart] = await transaction
        .update(carts)
        .set({ updatedAt: new Date() })
        .where(eq(carts.id, activeCart.id))
        .returning({
          createdAt: carts.createdAt,
          customerId: carts.customerId,
          id: carts.id,
          status: carts.status,
          updatedAt: carts.updatedAt,
        });

      return this.requireActiveCartRow(updatedCart);
    });

    return this.readCart(cart);
  }

  private async lockCustomerCart(
    transaction: CartTransaction,
    customerId: string,
  ): Promise<void> {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`active-cart:${customerId}`}))`,
    );
  }

  private async findActiveCart(
    transaction: CartTransaction,
    customerId: string,
  ): Promise<ActiveCartRow | undefined> {
    const [cart] = await transaction
      .select({
        createdAt: carts.createdAt,
        customerId: carts.customerId,
        id: carts.id,
        status: carts.status,
        updatedAt: carts.updatedAt,
      })
      .from(carts)
      .where(and(eq(carts.customerId, customerId), eq(carts.status, "ACTIVE")))
      .for("update")
      .limit(1);

    return cart?.status === "ACTIVE" ? { ...cart, status: "ACTIVE" } : undefined;
  }

  private async findOrCreateActiveCart(
    transaction: CartTransaction,
    customerId: string,
  ): Promise<ActiveCartRow> {
    const current = await this.findActiveCart(transaction, customerId);
    if (current) return current;

    const [created] = await transaction
      .insert(carts)
      .values({ customerId })
      .returning({
        createdAt: carts.createdAt,
        customerId: carts.customerId,
        id: carts.id,
        status: carts.status,
        updatedAt: carts.updatedAt,
      });

    return this.requireActiveCartRow(created);
  }

  private async requireAvailableProduct(
    transaction: CartTransaction,
    productId: string,
  ): Promise<Readonly<{ availableQuantity: number; currency: string }>> {
    const [product] = await transaction
      .select({ currency: products.currency, id: products.id })
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.status, "ACTIVE"),
          isNull(products.deletedAt),
        ),
      )
      .for("share")
      .limit(1);
    if (!product) throw new CartProductUnavailableError(productId);

    const [balance] = await transaction
      .select({ availableQuantity: inventoryBalances.availableQuantity })
      .from(inventoryBalances)
      .where(eq(inventoryBalances.productId, productId))
      .for("share")
      .limit(1);

    return {
      availableQuantity: balance?.availableQuantity ?? 0,
      currency: product.currency,
    };
  }

  private async assertCartCurrency(
    transaction: CartTransaction,
    cartId: string,
    productCurrency: string,
  ): Promise<void> {
    const [existingItem] = await transaction
      .select({ currency: products.currency })
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(
        and(
          eq(cartItems.cartId, cartId),
          ne(products.currency, productCurrency),
        ),
      )
      .limit(1);

    if (existingItem) {
      throw new CartCurrencyMismatchError(
        existingItem.currency,
        productCurrency,
      );
    }
  }

  private assertStock(
    productId: string,
    requestedQuantity: number,
    availableQuantity: number,
  ): void {
    if (
      requestedQuantity > POSTGRES_INTEGER_MAX ||
      requestedQuantity > availableQuantity
    ) {
      throw new CartInsufficientStockError(
        productId,
        requestedQuantity,
        availableQuantity,
      );
    }
  }

  private requireActiveCartRow(
    cart:
      | Readonly<{
          createdAt: Date;
          customerId: string;
          id: string;
          status: "ACTIVE" | "CHECKED_OUT" | "ABANDONED";
          updatedAt: Date;
        }>
      | undefined,
  ): ActiveCartRow {
    if (!cart || cart.status !== "ACTIVE") {
      throw new Error("PostgreSQL did not return the active cart");
    }
    return { ...cart, status: "ACTIVE" };
  }

  private async readCart(cart: ActiveCartRow): Promise<ActiveCart> {
    const stockAvailable = sql<number>`coalesce(${inventoryBalances.availableQuantity}, 0)`.mapWith(Number);
    const rows = await this.database.client
      .select({
        createdAt: cartItems.createdAt,
        currency: products.currency,
        imageStorageKey: productImages.storageKey,
        imageUrl: productImages.url,
        itemId: cartItems.id,
        name: products.name,
        price: products.price,
        productDeletedAt: products.deletedAt,
        productId: products.id,
        productStatus: products.status,
        quantity: cartItems.quantity,
        sku: products.sku,
        stockAvailable,
        updatedAt: cartItems.updatedAt,
      })
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .leftJoin(productImages, eq(productImages.productId, products.id))
      .leftJoin(
        inventoryBalances,
        eq(inventoryBalances.productId, products.id),
      )
      .where(eq(cartItems.cartId, cart.id))
      .orderBy(asc(cartItems.createdAt), asc(cartItems.id));
    const currencies = new Set(rows.map((row) => row.currency));
    if (currencies.size > 1) {
      const [cartCurrency = "", productCurrency = ""] = currencies;
      throw new CartCurrencyMismatchError(cartCurrency, productCurrency);
    }

    const totals = calculateCartTotals(
      rows.map((row) => ({ quantity: row.quantity, unitPrice: row.price })),
    );
    const items = rows.map((row, index) => ({
      id: row.itemId,
      productId: row.productId,
      quantity: row.quantity,
      subtotal: totals.lineSubtotals[index] ?? "0.00",
      product: {
        currency: row.currency,
        id: row.productId,
        image: {
          storageKey:
            row.imageStorageKey ?? `defaults/products/${row.productId}/placeholder.svg`,
          url: row.imageUrl ?? "/images/product-placeholder.svg",
        },
        isAvailable:
          row.productStatus === "ACTIVE" &&
          row.productDeletedAt === null &&
          row.stockAvailable > 0,
        name: row.name,
        price: row.price,
        sku: row.sku,
        stockAvailable: row.stockAvailable,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return {
      ...cart,
      currency: currencies.values().next().value ?? null,
      items,
      status: "ACTIVE",
      subtotal: totals.subtotal,
      total: totals.total,
      totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    };
  }
}
