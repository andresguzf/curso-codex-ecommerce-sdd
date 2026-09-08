import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import {
  type EnvironmentVariables,
  validateEnvironment,
} from "../config/environment";
import type { PaymentMethod } from "./payment/payment.port";
import { SimulatedPaymentAdapter } from "./payment/simulated-payment.adapter";
import type { ShippingMethod } from "./shipping/shipping.port";
import { SimulatedShippingAdapter } from "./shipping/simulated-shipping.adapter";

const databaseUrl = "postgresql://postgres:password@localhost:5432/ecommerce";

function shippingAdapter(
  overrides: Partial<EnvironmentVariables> = {},
): SimulatedShippingAdapter {
  const environment = validateEnvironment({
    DATABASE_URL: databaseUrl,
    ...overrides,
  });
  return new SimulatedShippingAdapter(
    new ConfigService<EnvironmentVariables, true>(environment),
  );
}

describe("SimulatedPaymentAdapter", () => {
  const baseRequest = {
    amount: "120.50",
    attemptReference: "checkout-attempt-123",
    currency: "USD",
  } as const;

  it("approves the successful test method deterministically", async () => {
    const adapter = new SimulatedPaymentAdapter();
    const request = {
      ...baseRequest,
      method: "SIMULATED_CARD_APPROVED" as const,
    };

    const first = await adapter.process(request);
    const repeated = await adapter.process(request);

    expect(first).toEqual(repeated);
    expect(first).toMatchObject({
      amount: "120.50",
      currency: "USD",
      method: "SIMULATED_CARD_APPROVED",
      providerReference: expect.stringMatching(/^sim_[a-f0-9]{24}$/),
      snapshot: {
        adapter: "SIMULATED",
        decisionCode: "SIMULATED_APPROVAL",
      },
      status: "APPROVED",
    });
  });

  it("rejects the declined test method deterministically", async () => {
    const adapter = new SimulatedPaymentAdapter();
    const result = await adapter.process({
      ...baseRequest,
      method: "SIMULATED_CARD_REJECTED",
    });

    expect(result).toMatchObject({
      method: "SIMULATED_CARD_REJECTED",
      snapshot: { decisionCode: "SIMULATED_DECLINE" },
      status: "REJECTED",
    });
  });

  it("rejects an unsupported payment method at the adapter boundary", async () => {
    const adapter = new SimulatedPaymentAdapter();

    await expect(
      adapter.process({
        ...baseRequest,
        method: "UNSUPPORTED" as PaymentMethod,
      }),
    ).rejects.toMatchObject({
      method: "UNSUPPORTED",
      name: "UnsupportedPaymentMethodError",
    });
  });
});

describe("SimulatedShippingAdapter", () => {
  const baseRequest = {
    currency: "USD",
    destination: { countryCode: "CL", postalCode: "8320000" },
  } as const;

  it("quotes every method with configured exact costs and delivery windows", async () => {
    const adapter = shippingAdapter({
      SIMULATED_SHIPPING_EXPRESS_COST: "18.40",
      SIMULATED_SHIPPING_PICKUP_COST: "0.00",
      SIMULATED_SHIPPING_STANDARD_COST: "7.25",
    });

    const [pickup, standard, express] = await Promise.all([
      adapter.quote({ ...baseRequest, method: "PICKUP" }),
      adapter.quote({ ...baseRequest, method: "STANDARD" }),
      adapter.quote({ ...baseRequest, method: "EXPRESS" }),
    ]);

    expect(pickup).toMatchObject({
      cost: "0.00",
      currency: "USD",
      estimatedDeliveryDays: null,
      name: "Store pickup",
    });
    expect(standard).toMatchObject({
      cost: "7.25",
      estimatedDeliveryDays: { maximum: 5, minimum: 3 },
      name: "Standard delivery",
    });
    expect(express).toMatchObject({
      cost: "18.40",
      estimatedDeliveryDays: { maximum: 2, minimum: 1 },
      name: "Express delivery",
    });
    expect(express.snapshot).toEqual({
      adapter: "SIMULATED",
      cost: "18.40",
      currency: "USD",
      estimatedDeliveryDays: { maximum: 2, minimum: 1 },
      method: "EXPRESS",
      name: "Express delivery",
    });
  });

  it("returns the same quote for repeated equivalent requests", async () => {
    const adapter = shippingAdapter();
    const request = { ...baseRequest, method: "STANDARD" as const };

    await expect(adapter.quote(request)).resolves.toEqual(
      await adapter.quote(request),
    );
  });

  it("rejects an unsupported shipping method at the adapter boundary", async () => {
    const adapter = shippingAdapter();

    await expect(
      adapter.quote({
        ...baseRequest,
        method: "UNSUPPORTED" as ShippingMethod,
      }),
    ).rejects.toMatchObject({
      method: "UNSUPPORTED",
      name: "UnsupportedShippingMethodError",
    });
  });
});
