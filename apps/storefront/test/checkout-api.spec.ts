import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("checkout HTTP client", () => {
  it("explains a missing issuer profile without treating the checkout as uncertain", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "STORE_PROFILE_NOT_CONFIGURED" }, { status: 409 })));
    const { submitCheckout } = await import("../src/features/checkout/checkout-api");
    await expect(submitCheckout("access-token", {
      paymentMethod: "SIMULATED_CARD_APPROVED", shippingMethod: "PICKUP",
      shippingAddress: { recipientName: "Cliente", line1: "Av. Central 123", city: "Santiago", region: "RM", postalCode: "8320000", countryCode: "CL" },
    }, "missing-profile-key")).rejects.toMatchObject({
      code: "STORE_PROFILE_NOT_CONFIGURED", uncertain: false,
      message: "La tienda aún no está configurada para emitir órdenes. Inténtalo más tarde.",
    });
  });

  it("sends the bearer token and stable idempotency header and maps a rejected payment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: "PAYMENT_REJECTED" }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const { submitCheckout } = await import("../src/features/checkout/checkout-api");
    const input = {
      paymentMethod: "SIMULATED_CARD_REJECTED" as const,
      shippingMethod: "PICKUP" as const,
      shippingAddress: { recipientName: "Cliente", line1: "Av. Central 123", city: "Santiago", region: "RM", postalCode: "8320000", countryCode: "CL" },
    };
    await expect(submitCheckout("access-token", input, "stable-attempt-key")).rejects.toMatchObject({ code: "PAYMENT_REJECTED", uncertain: false });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("POST");
    expect(request.url).toContain("/api/v1/checkout");
    expect(request.headers.get("Authorization")).toBe("Bearer access-token");
    expect(request.headers.get("Idempotency-Key")).toBe("stable-attempt-key");
    expect(await request.json()).toEqual(input);
  });
});
