export const SHIPPING_METHODS = ["PICKUP", "STANDARD", "EXPRESS"] as const;

export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export type ShippingQuoteRequest = Readonly<{
  currency: SystemCurrency;
  destination: Readonly<{
    countryCode: string;
    postalCode: string;
  }>;
  method: ShippingMethod;
}>;

export type ShippingQuote = Readonly<{
  cost: string;
  currency: SystemCurrency;
  estimatedDeliveryDays: Readonly<{
    maximum: number;
    minimum: number;
  }> | null;
  method: ShippingMethod;
  name: string;
  snapshot: Readonly<{
    adapter: "SIMULATED";
    cost: string;
    currency: SystemCurrency;
    estimatedDeliveryDays: Readonly<{
      maximum: number;
      minimum: number;
    }> | null;
    method: ShippingMethod;
    name: string;
  }>;
}>;

export abstract class ShippingQuoteProvider {
  abstract quote(request: ShippingQuoteRequest): Promise<ShippingQuote>;
}

export class UnsupportedShippingMethodError extends Error {
  constructor(readonly method: string) {
    super(`Unsupported shipping method: ${method}`);
    this.name = "UnsupportedShippingMethodError";
  }
}
import type { SystemCurrency } from "../../shared/system-currency";
