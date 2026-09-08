import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  CartCurrencyMismatchError,
  CartInsufficientStockError,
  CartItemNotFoundError,
  CartProductUnavailableError,
  CartRepository,
} from "./cart.repository";
import type { ActiveCart, AddCartItem } from "./cart.types";

@Injectable()
export class CartService {
  constructor(
    @Inject(CartRepository) private readonly repository: CartRepository,
  ) {}

  get(customerId: string): Promise<ActiveCart> {
    return this.mapErrors(() => this.repository.getOrCreateActive(customerId));
  }

  async addItem(customerId: string, input: AddCartItem): Promise<ActiveCart> {
    return this.mapErrors(() =>
      this.repository.addItem(
        customerId,
        input.productId,
        input.quantity,
      ),
    );
  }

  async updateItem(
    customerId: string,
    itemId: string,
    quantity: number,
  ): Promise<ActiveCart> {
    return this.mapErrors(() =>
      this.repository.updateItem(customerId, itemId, quantity),
    );
  }

  async removeItem(customerId: string, itemId: string): Promise<ActiveCart> {
    return this.mapErrors(() => this.repository.removeItem(customerId, itemId));
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
      if (error instanceof CartCurrencyMismatchError) {
        throw new ConflictException({
          code: "CART_CURRENCY_MISMATCH",
          details: {
            cartCurrency: error.cartCurrency,
            productCurrency: error.productCurrency,
          },
          message: "The cart cannot contain products in different currencies",
        });
      }
      throw error;
    }
  }
}
