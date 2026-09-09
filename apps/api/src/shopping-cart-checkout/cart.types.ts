export type CartProduct = Readonly<{
  id: string;
  sku: string;
  name: string;
  price: string;
  currency: "USD";
  image: Readonly<{
    storageKey: string;
    url: string;
  }>;
  stockAvailable: number;
  isAvailable: boolean;
}>;

export type ActiveCartItem = Readonly<{
  id: string;
  productId: string;
  quantity: number;
  subtotal: string;
  product: CartProduct;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ActiveCart = Readonly<{
  id: string;
  customerId: string | null;
  status: "ACTIVE";
  items: readonly ActiveCartItem[];
  totalQuantity: number;
  currency: "USD" | null;
  subtotal: string;
  total: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CartOwner =
  | Readonly<{
      kind: "customer";
      customerId: string;
    }>
  | Readonly<{
      kind: "anonymous";
      anonymousTokenHash: string;
      expiresAt: Date;
    }>;

export type CartClaimResult = Readonly<{
  adjustedProductIds: readonly string[];
  cart: ActiveCart;
}>;

export type AddCartItem = Readonly<{
  productId: string;
  quantity: number;
}>;
