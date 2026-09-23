"use client";

import { useRouter } from "next/navigation";
import { useFlashStore } from "@technology-ecommerce/ui";

import { CartApiError } from "./cart-api";
import { useCart } from "./use-cart";

export function useAddToCart() {
  const router = useRouter();
  const showFlash = useFlashStore((state) => state.showFlash);
  const { addItem, isAdding } = useCart();

  async function addProduct(product: Readonly<{ id: string; name: string }>): Promise<void> {
    try {
      await addItem({ productId: product.id, quantity: 1 });
      showFlash("success", `${product.name} fue agregado al carrito.`);
      router.push("/cart");
    } catch (error) {
      showFlash(
        "error",
        error instanceof CartApiError
          ? error.message
          : "No pudimos agregar el producto al carrito. Inténtalo nuevamente.",
      );
    }
  }

  return {
    addProduct,
    isAdding,
  };
}
