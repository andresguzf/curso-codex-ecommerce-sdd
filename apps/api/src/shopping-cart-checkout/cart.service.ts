import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  CartInsufficientStockError,
  CartItemNotFoundError,
  CartProductUnavailableError,
  CartRepository,
} from "./cart.repository";
import type {
  ActiveCart,
  AddCartItem,
  CartClaimResult,
  CartOwner,
} from "./cart.types";

@Injectable()
export class CartService {
  constructor(
    @Inject(CartRepository) private readonly repository: CartRepository,
  ) {}

  get(owner: CartOwner): Promise<ActiveCart> {
    return this.mapErrors(() => this.repository.getOrCreateActive(owner));
  }

  async addItem(owner: CartOwner, input: AddCartItem): Promise<ActiveCart> {
    return this.mapErrors(() =>
      this.repository.addItem(
        owner,
        input.productId,
        input.quantity,
      ),
    );
  }

  async updateItem(
    owner: CartOwner,
    itemId: string,
    quantity: number,
  ): Promise<ActiveCart> {
    return this.mapErrors(() =>
      this.repository.updateItem(owner, itemId, quantity),
    );
  }

  async removeItem(owner: CartOwner, itemId: string): Promise<ActiveCart> {
    return this.mapErrors(() => this.repository.removeItem(owner, itemId));
  }

  async claimAnonymousCart(
    customerId: string,
    anonymousTokenHash: string | undefined,
  ): Promise<CartClaimResult> {
    if (!anonymousTokenHash) {
      return {
        adjustedProductIds: [],
        cart: await this.get({ customerId, kind: "customer" }),
      };
    }
    return this.repository.claimAnonymousCart(customerId, anonymousTokenHash);
  }

  private async mapErrors(operation: () => Promise<ActiveCart>): Promise<ActiveCart> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CartItemNotFoundError) {
        throw new NotFoundException({
          code: "CART_ITEM_NOT_FOUND",
          message: "The requested cart item does not exist",
        });
      }
      if (error instanceof CartProductUnavailableError) {
        throw new ConflictException({
          code: "CART_PRODUCT_UNAVAILABLE",
          details: { productId: error.productId },
          message: "The product is not available for purchase",
        });
      }
      if (error instanceof CartInsufficientStockError) {
        throw new ConflictException({
          code: "CART_INSUFFICIENT_STOCK",
          details: {
            availableQuantity: error.availableQuantity,
            productId: error.productId,
            requestedQuantity: error.requestedQuantity,
          },
          message: "The requested quantity exceeds available inventory",
        });
      }
      throw error;
    }
  }
}
