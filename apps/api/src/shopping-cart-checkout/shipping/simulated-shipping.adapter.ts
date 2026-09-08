import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/environment";
import {
  SHIPPING_METHODS,
  type ShippingMethod,
  type ShippingQuote,
  ShippingQuoteProvider,
  type ShippingQuoteRequest,
  UnsupportedShippingMethodError,
} from "./shipping.port";

type ShippingMethodConfiguration = Readonly<{
  cost: string;
  estimatedDeliveryDays: ShippingQuote["estimatedDeliveryDays"];
  name: string;
}>;

@Injectable()
export class SimulatedShippingAdapter extends ShippingQuoteProvider {
  private readonly methods: Readonly<Record<ShippingMethod, ShippingMethodConfiguration>>;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
    this.methods = {
      EXPRESS: {
        cost: config.get("SIMULATED_SHIPPING_EXPRESS_COST", { infer: true }),
        estimatedDeliveryDays: { maximum: 2, minimum: 1 },
        name: "Express delivery",
      },
      PICKUP: {
        cost: config.get("SIMULATED_SHIPPING_PICKUP_COST", { infer: true }),
        estimatedDeliveryDays: null,
        name: "Store pickup",
      },
      STANDARD: {
        cost: config.get("SIMULATED_SHIPPING_STANDARD_COST", { infer: true }),
        estimatedDeliveryDays: { maximum: 5, minimum: 3 },
        name: "Standard delivery",
      },
    };
  }

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuote> {
    const method = this.configurationFor(request.method);
    const snapshot = {
      adapter: "SIMULATED" as const,
      cost: method.cost,
      currency: request.currency,
      estimatedDeliveryDays: method.estimatedDeliveryDays,
      method: request.method,
      name: method.name,
    };

    return { ...snapshot, snapshot };
  }

  private configurationFor(
    method: ShippingMethod,
  ): ShippingMethodConfiguration {
    if (!SHIPPING_METHODS.includes(method)) {
      throw new UnsupportedShippingMethodError(method);
    }

    return this.methods[method];
  }
}
