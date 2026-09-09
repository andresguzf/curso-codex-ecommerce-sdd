"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CheckoutRequest } from "@technology-ecommerce/api-schemas";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useSessionStore } from "../auth/session";
import { CART_QUERY_ROOT } from "../cart/use-cart";
import { CheckoutApiError, submitCheckout } from "./checkout-api";

export const checkoutReceiptKey = (customerId: string, orderId: string) =>
  ["checkout-receipt", customerId, orderId] as const;

export function useCheckout(customerId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const attempt = useRef<{ input: CheckoutRequest; key: string } | null>(null);
  const busy = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (input: CheckoutRequest) => {
      const session = useSessionStore.getState().session;
      if (!session || session.user.id !== customerId) throw new CheckoutApiError(401);
      attempt.current ??= { input, key: crypto.randomUUID() };
      return submitCheckout(session.accessToken, attempt.current.input, attempt.current.key);
    },
    onSuccess: (result) => {
      queryClient.setQueryData(checkoutReceiptKey(customerId, result.order.id), result);
      attempt.current = null;
      setUncertain(false);
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_ROOT });
      void queryClient.invalidateQueries({ queryKey: ["catalog"] });
      router.push(`/checkout/orders/${result.order.id}`);
    },
    onError: (error) => {
      const unresolved = !(error instanceof CheckoutApiError) || error.uncertain;
      setUncertain(unresolved);
      if (!unresolved) {
        attempt.current = null;
        void queryClient.invalidateQueries({ queryKey: CART_QUERY_ROOT });
      }
      if (error instanceof CheckoutApiError && error.status === 401) {
        router.replace("/login?returnTo=%2Fcheckout");
      }
    },
  });

  async function confirm(input: CheckoutRequest) {
    if (busy.current || mutation.isSuccess) return;
    busy.current = true;
    try { await mutation.mutateAsync(input); } catch { /* Feedback is rendered from mutation.error. */ }
    finally { busy.current = false; }
  }

  return { confirm, uncertain, mutation };
}
