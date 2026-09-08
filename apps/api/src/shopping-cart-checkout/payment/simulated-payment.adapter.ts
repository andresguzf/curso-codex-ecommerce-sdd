import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";

import {
  PAYMENT_METHODS,
  PaymentProcessor,
  type PaymentMethod,
  type PaymentRequest,
  type PaymentResult,
  UnsupportedPaymentMethodError,
} from "./payment.port";

const PAYMENT_OUTCOME_BY_METHOD = {
  SIMULATED_CARD_APPROVED: {
    decisionCode: "SIMULATED_APPROVAL",
    status: "APPROVED",
  },
  SIMULATED_CARD_REJECTED: {
    decisionCode: "SIMULATED_DECLINE",
    status: "REJECTED",
  },
} as const satisfies Record<
  PaymentMethod,
  Readonly<{
    decisionCode: PaymentResult["snapshot"]["decisionCode"];
    status: PaymentResult["status"];
  }>
>;

@Injectable()
export class SimulatedPaymentAdapter extends PaymentProcessor {
  async process(request: PaymentRequest): Promise<PaymentResult> {
    const outcome = this.outcomeFor(request.method);
    const providerReference = `sim_${createHash("sha256")
      .update(`${request.attemptReference}\0${request.method}`)
      .digest("hex")
      .slice(0, 24)}`;

    return {
      amount: request.amount,
      currency: request.currency,
      method: request.method,
      providerReference,
      status: outcome.status,
      snapshot: {
        adapter: "SIMULATED",
        decisionCode: outcome.decisionCode,
        method: request.method,
      },
    };
  }

  private outcomeFor(method: PaymentMethod) {
    if (!PAYMENT_METHODS.includes(method)) {
      throw new UnsupportedPaymentMethodError(method);
    }

    return PAYMENT_OUTCOME_BY_METHOD[method];
  }
}
