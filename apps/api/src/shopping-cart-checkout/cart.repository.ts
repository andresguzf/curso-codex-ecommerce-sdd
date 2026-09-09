import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import {
  cartItems,
  carts,
  inventoryBalances,
  productImages,
  products,
} from "../database/schema";
import { SYSTEM_CURRENCY } from "../shared/system-currency";
import { calculateCartTotals } from "./cart-totals";
import type {
  ActiveCart,
  CartClaimResult,
  CartOwner,
} from "./cart.types";

const POSTGRES_INTEGER_MAX = 2_147_483_647;

type CartTransaction = Parameters<
  Parameters<DatabaseService["client"]["transaction"]>[0]
>[0];

type ActiveCartRow = Readonly<{
  id: string;
  anonymousTokenHash: string | null;
  customerId: string | null;
  expiresAt: Date | null;
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

@Injectable()
export class CartRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async getOrCreateActive(owner: CartOwner): Promise<ActiveCart> {
    const cart = await this.database.client.transaction(async (transaction) => {
      await this.lockOwnerCart(transaction, owner);
      return this.findOrCreateActiveCart(transaction, owner);
    });

    return this.readCart(cart);
  }

  async deleteExpiredAnonymousCarts(now = new Date()): Promise<number> {
    const deleted = await this.database.client
      .delete(carts)
      .where(
        and(
          isNull(carts.customerId),
          eq(carts.status, "ACTIVE"),
          lte(carts.expiresAt, now),
        ),
      )
      .returning({ id: carts.id });

    return deleted.length;
  }

  async addItem(
    owner: CartOwner,
    productId: string,
    quantity: number,
  ): Promise<ActiveCart> {
    const cart = await this.database.client.transaction(async (transaction) => {
      await this.lockOwnerCart(transaction, owner);
      const activeCart = await this.findOrCreateActiveCart(
        transaction,
        owner,
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
        .set({
          expiresAt: owner.kind === "anonymous" ? owner.expiresAt : null,
          updatedAt: now,
        })
        .where(eq(carts.id, activeCart.id))
        .returning({
          createdAt: carts.createdAt,
          anonymousTokenHash: carts.anonymousTokenHash,
          customerId: carts.customerId,
          expiresAt: carts.expiresAt,
          id: carts.id,
          status: carts.status,
          updatedAt: carts.updatedAt,
        });

      return this.requireActiveCartRow(updatedCart);
    });

    return this.readCart(cart);
  }

  async updateItem(
    owner: CartOwner,
    itemId: string,
    quantity: number,
  ): Promise<ActiveCart> {
    const cart = await this.database.client.transaction(async (transaction) => {
      await this.lockOwnerCart(transaction, owner);
      const activeCart = await this.findActiveCart(transaction, owner);
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
        .set({
          expiresAt: owner.kind === "anonymous" ? owner.expiresAt : null,
          updatedAt: now,
        })
        .where(eq(carts.id, activeCart.id))
        .returning({
          createdAt: carts.createdAt,
          anonymousTokenHash: carts.anonymousTokenHash,
          customerId: carts.customerId,
          expiresAt: carts.expiresAt,
          id: carts.id,
          status: carts.status,
          updatedAt: carts.updatedAt,
        });

      return this.requireActiveCartRow(updatedCart);
    });

    return this.readCart(cart);
  }

  async removeItem(owner: CartOwner, itemId: string): Promise<ActiveCart> {
    const cart = await this.database.client.transaction(async (transaction) => {
      await this.lockOwnerCart(transaction, owner);
      const activeCart = await this.findActiveCart(transaction, owner);
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
        .set({
          expiresAt: owner.kind === "anonymous" ? owner.expiresAt : null,
          updatedAt: new Date(),
        })
        .where(eq(carts.id, activeCart.id))
        .returning({
          createdAt: carts.createdAt,
          anonymousTokenHash: carts.anonymousTokenHash,
          customerId: carts.customerId,
          expiresAt: carts.expiresAt,
          id: carts.id,
          status: carts.status,
          updatedAt: carts.updatedAt,
        });

      return this.requireActiveCartRow(updatedCart);
    });

    return this.readCart(cart);
  }

  async claimAnonymousCart(
    customerId: string,
    anonymousTokenHash: string,
  ): Promise<CartClaimResult> {
    const result = await this.database.client.transaction(async (transaction) => {
      const lockKeys = [
        `anonymous:${anonymousTokenHash}`,
        `customer:${customerId}`,
      ].sort();
      for (const key of lockKeys) {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`active-cart:${key}`}))`,
        );
      }

      const anonymousOwner: CartOwner = {
        anonymousTokenHash,
        expiresAt: new Date(),
        kind: "anonymous",
      };
      const customerOwner: CartOwner = { customerId, kind: "customer" };
      const anonymousCart = await this.findActiveCart(
        transaction,
        anonymousOwner,
      );
      if (!anonymousCart) {
        return {
          adjustedProductIds: [] as string[],
          cart: await this.findOrCreateActiveCart(transaction, customerOwner),
        };
      }

      const customerCart = await this.findActiveCart(transaction, customerOwner);
      if (!customerCart) {
        const [claimed] = await transaction
          .update(carts)
          .set({
            anonymousTokenHash: null,
            customerId,
            expiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(carts.id, anonymousCart.id))
          .returning(this.cartSelection());
        return {
          adjustedProductIds: [] as string[],
          cart: this.requireActiveCartRow(claimed),
        };
      }

      const anonymousItems = await transaction
        .select({
          id: cartItems.id,
          productId: cartItems.productId,
          quantity: cartItems.quantity,
        })
        .from(cartItems)
        .where(eq(cartItems.cartId, anonymousCart.id))
        .for("update");
      const adjustedProductIds: string[] = [];
      for (const anonymousItem of anonymousItems) {
        const [existing] = await transaction
          .select({ id: cartItems.id, quantity: cartItems.quantity })
          .from(cartItems)
          .where(
            and(
              eq(cartItems.cartId, customerCart.id),
              eq(cartItems.productId, anonymousItem.productId),
            ),
          )
          .for("update")
          .limit(1);
        let availableQuantity = 0;
        try {
          const product = await this.requireAvailableProduct(
            transaction,
            anonymousItem.productId,
          );
          availableQuantity = product.availableQuantity;
        } catch (error) {
          if (!(error instanceof CartProductUnavailableError)) throw error;
        }
        const requestedQuantity = (existing?.quantity ?? 0) + anonymousItem.quantity;
        const mergedQuantity = Math.min(requestedQuantity, availableQuantity);
        if (mergedQuantity < requestedQuantity) {
          adjustedProductIds.push(anonymousItem.productId);
        }

        if (mergedQuantity === 0) continue;
        if (existing) {
          await transaction
            .update(cartItems)
            .set({ quantity: mergedQuantity, updatedAt: new Date() })
            .where(eq(cartItems.id, existing.id));
        } else {
          await transaction.insert(cartItems).values({
            cartId: customerCart.id,
            productId: anonymousItem.productId,
            quantity: mergedQuantity,
          });
        }
      }

      await transaction.delete(carts).where(eq(carts.id, anonymousCart.id));
      const [updated] = await transaction
        .update(carts)
        .set({ updatedAt: new Date() })
        .where(eq(carts.id, customerCart.id))
        .returning(this.cartSelection());

      return {
        adjustedProductIds,
        cart: this.requireActiveCartRow(updated),
      };
    });

    return {
      adjustedProductIds: result.adjustedProductIds,
      cart: await this.readCart(result.cart),
    };
  }

  private async lockOwnerCart(
    transaction: CartTransaction,
    owner: CartOwner,
  ): Promise<void> {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`active-cart:${this.ownerKey(owner)}`}))`,
    );
  }

  private async findActiveCart(
    transaction: CartTransaction,
    owner: CartOwner,
  ): Promise<ActiveCartRow | undefined> {
    const [cart] = await transaction
      .select(this.cartSelection())
      .from(carts)
      .where(
        and(
          owner.kind === "customer"
            ? eq(carts.customerId, owner.customerId)
            : eq(carts.anonymousTokenHash, owner.anonymousTokenHash),
          eq(carts.status, "ACTIVE"),
        ),
      )
      .for("update")
      .limit(1);

    if (cart?.status !== "ACTIVE") return undefined;
    if (
      owner.kind === "anonymous" &&
      (!cart.expiresAt || cart.expiresAt.getTime() <= Date.now())
    ) {
      await transaction
        .update(carts)
        .set({ closedAt: new Date(), status: "ABANDONED", updatedAt: new Date() })
        .where(eq(carts.id, cart.id));
      return undefined;
    }
    return { ...cart, status: "ACTIVE" };
  }

  private async findOrCreateActiveCart(
    transaction: CartTransaction,
    owner: CartOwner,
  ): Promise<ActiveCartRow> {
    const current = await this.findActiveCart(transaction, owner);
    if (current) {
      if (owner.kind !== "anonymous") return current;
      const [refreshed] = await transaction
        .update(carts)
        .set({ expiresAt: owner.expiresAt, updatedAt: new Date() })
        .where(eq(carts.id, current.id))
        .returning(this.cartSelection());
      return this.requireActiveCartRow(refreshed);
    }

    const [created] = await transaction
      .insert(carts)
      .values(owner.kind === "customer"
        ? { customerId: owner.customerId }
        : {
            anonymousTokenHash: owner.anonymousTokenHash,
            expiresAt: owner.expiresAt,
          })
      .returning(this.cartSelection());

    return this.requireActiveCartRow(created);
  }

  private async requireAvailableProduct(
    transaction: CartTransaction,
    productId: string,
  ): Promise<Readonly<{ availableQuantity: number }>> {
    const [product] = await transaction
      .select({ id: products.id })
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
    };
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
          anonymousTokenHash: string | null;
          customerId: string | null;
          expiresAt: Date | null;
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

  private cartSelection() {
    return {
      anonymousTokenHash: carts.anonymousTokenHash,
      createdAt: carts.createdAt,
      customerId: carts.customerId,
      expiresAt: carts.expiresAt,
      id: carts.id,
      status: carts.status,
      updatedAt: carts.updatedAt,
    };
  }

  private ownerKey(owner: CartOwner): string {
    return owner.kind === "customer"
      ? `customer:${owner.customerId}`
      : `anonymous:${owner.anonymousTokenHash}`;
  }

  private async readCart(cart: ActiveCartRow): Promise<ActiveCart> {
    const stockAvailable = sql<number>`coalesce(${inventoryBalances.availableQuantity}, 0)`.mapWith(Number);
    const rows = await this.database.client
      .select({
        createdAt: cartItems.createdAt,
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
    const totals = calculateCartTotals(
      rows.map((row) => ({ quantity: row.quantity, unitPrice: row.price })),
    );
    const items = rows.map((row, index) => ({
      id: row.itemId,
      productId: row.productId,
      quantity: row.quantity,
      subtotal: totals.lineSubtotals[index] ?? "0.00",
      product: {
        currency: SYSTEM_CURRENCY,
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
      createdAt: cart.createdAt,
      customerId: cart.customerId,
      id: cart.id,
      currency: rows.length > 0 ? SYSTEM_CURRENCY : null,
      items,
      status: "ACTIVE",
      subtotal: totals.subtotal,
      total: totals.total,
      totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
      updatedAt: cart.updatedAt,
    };
  }
}
