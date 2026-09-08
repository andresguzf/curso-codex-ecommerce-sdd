import { describe, expect, it } from "vitest";

import { checkoutRequestSchema, checkoutResultSchema } from "../src/checkout";

const address = {
  city: "Santiago",
  countryCode: "CL",
  line1: "Avenida Tecnología 123",
  postalCode: "8320000",
  recipientName: "Cliente Demo",
  region: "Región Metropolitana",
};

describe("checkout schemas", () => {
  it("validates supported payment, shipping, and address inputs", () => {
    expect(
      checkoutRequestSchema.safeParse({
        paymentMethod: "SIMULATED_CARD_APPROVED",
        shippingAddress: address,
        shippingMethod: "STANDARD",
      }).success,
    ).toBe(true);
    expect(
      checkoutRequestSchema.safeParse({
        paymentMethod: "CARD",
        shippingAddress: { ...address, countryCode: "Chile" },
        shippingMethod: "DRONE",
      }).success,
    ).toBe(false);
  });

  it("validates the immutable order and approved payment response", () => {
    expect(
      checkoutResultSchema.safeParse({
        order: {
          createdAt: "2026-09-08T12:00:00.000Z",
          currency: "USD",
          id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
          items: [
            {
              currency: "USD",
              lineTotal: "200.00",
              name: "Mechanical Keyboard",
              productId: "f69d57cb-3473-4ee4-8474-5d71aefbcbe5",
              quantity: 2,
              sku: "KEYBOARD-001",
              taxAmount: "0.00",
              unitPrice: "100.00",
            },
          ],
          number: "ORD-3296F1D5-5A1D-4B94-9CAA-B26878F447E4",
          shippingTotal: "5.00",
          status: "PROCESSING",
          subtotal: "200.00",
          taxTotal: "0.00",
          total: "205.00",
        },
        payment: {
          method: "SIMULATED_CARD_APPROVED",
          providerReference: "sim_1234567890abcdef12345678",
          status: "APPROVED",
        },
      }).success,
    ).toBe(true);
  });
});
