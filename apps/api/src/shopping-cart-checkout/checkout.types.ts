import type { PaymentMethod, PaymentStatus } from "./payment/payment.port";
import type { ShippingMethod } from "./shipping/shipping.port";

export type CheckoutAddress = Readonly<{
  recipientName: string;
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}>;

export type CheckoutInput = Readonly<{
  paymentMethod: PaymentMethod;
  shippingMethod: ShippingMethod;
  shippingAddress: CheckoutAddress;
}>;

export type CheckoutCustomer = Readonly<{
  id: string;
  email: string;
  displayName: string;
}>;

export type CheckoutOrderItem = Readonly<{
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  taxAmount: string;
  lineTotal: string;
  currency: string;
}>;

export type CheckoutResult = Readonly<{
  order: Readonly<{
    id: string;
    number: string;
    status: "PROCESSING";
    currency: string;
    subtotal: string;
    shippingTotal: string;
    taxTotal: string;
    total: string;
    items: readonly CheckoutOrderItem[];
    createdAt: string;
  }>;
  payment: Readonly<{
    status: "APPROVED";
    method: PaymentMethod;
    providerReference: string;
  }>;
}>;

export type RejectedCheckoutResult = Readonly<{
  payment: Readonly<{
    status: Extract<PaymentStatus, "REJECTED">;
    method: PaymentMethod;
    providerReference: string;
  }>;
}>;
