export type CartProduct = Readonly<{
  id: string;
  sku: string;
  name: string;
  price: string;
  currency: string;
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
  customerId: string;
  status: "ACTIVE";
  items: readonly ActiveCartItem[];
  totalQuantity: number;
  currency: string | null;
  subtotal: string;
  total: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type AddCartItem = Readonly<{
  productId: string;
  quantity: number;
}>;
