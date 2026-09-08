export const PAYMENT_METHODS = [
  "SIMULATED_CARD_APPROVED",
  "SIMULATED_CARD_REJECTED",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentStatus = "APPROVED" | "REJECTED";

export type PaymentRequest = Readonly<{
  amount: string;
  attemptReference: string;
  currency: string;
  method: PaymentMethod;
}>;

export type PaymentResult = Readonly<{
  amount: string;
  currency: string;
  method: PaymentMethod;
  providerReference: string;
  status: PaymentStatus;
  snapshot: Readonly<{
    adapter: "SIMULATED";
    decisionCode: "SIMULATED_APPROVAL" | "SIMULATED_DECLINE";
    method: PaymentMethod;
  }>;
}>;

export abstract class PaymentProcessor {
  abstract process(request: PaymentRequest): Promise<PaymentResult>;
}

export class UnsupportedPaymentMethodError extends Error {
  constructor(readonly method: string) {
    super(`Unsupported payment method: ${method}`);
    this.name = "UnsupportedPaymentMethodError";
  }
}
