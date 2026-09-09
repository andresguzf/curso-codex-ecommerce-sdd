"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { CartApiError } from "./cart-api";
import { useCartUiStore } from "./cart-ui-store";
import { useCart } from "./use-cart";

export type CartActionFeedback = Readonly<{
  kind: "error" | "success";
  message: string;
}>;

export function useAddToCart() {
  const router = useRouter();
  const [feedback, setFeedback] = useState<CartActionFeedback | null>(null);
  const clearNotice = useCartUiStore((state) => state.clearNotice);
  const setNotice = useCartUiStore((state) => state.setNotice);
  const { addItem, isAdding } = useCart();

  async function addProduct(product: Readonly<{ id: string; name: string }>): Promise<void> {
    setFeedback(null);
    clearNotice();

    try {
      await addItem({ productId: product.id, quantity: 1 });
      setNotice(`${product.name} fue agregado al carrito.`);
      router.push("/cart");
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof CartApiError
          ? error.message
          : "No pudimos agregar el producto al carrito. Inténtalo nuevamente.",
      });
    }
  }

  return {
    addProduct,
    feedback,
    isAdding,
  };
}
