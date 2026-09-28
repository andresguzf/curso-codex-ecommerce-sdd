"use client";

import { ConfirmationDialog, useFlashStore } from "@technology-ecommerce/ui";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useSessionStore } from "../auth/session";
import { WishlistApiError } from "./wishlist-api";
import { useWishlistActions, useWishlistMembership } from "./use-wishlist";

export function WishlistButton({ productId, productName, variant = "icon" }: Readonly<{
  productId: string;
  productName: string;
  variant?: "icon" | "label";
}>) {
  const [confirming, setConfirming] = useState(false);
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);
  const membership = useWishlistMembership();
  const { add, remove } = useWishlistActions();
  const showFlash = useFlashStore((state) => state.showFlash);
  const pathname = usePathname();
  const router = useRouter();
  const isSaved = membership.data?.has(productId) ?? false;
  const isPending = add.isPending || remove.isPending;
  const isCustomer = status === "authenticated" && session?.user.role === "CUSTOMER";

  async function save(): Promise<void> {
    try {
      const added = await add.mutateAsync(productId);
      showFlash("success", added ? `${productName} guardado en tus deseos.` : `${productName} ya estaba en tus deseos.`);
    } catch (error) {
      showFlash("error", error instanceof WishlistApiError ? error.message : "No pudimos guardar el producto. Inténtalo nuevamente.");
    }
  }

  async function removeSaved(): Promise<void> {
    try {
      await remove.mutateAsync(productId);
      setConfirming(false);
      showFlash("success", `${productName} eliminado de tus deseos.`);
    } catch (error) {
      setConfirming(false);
      showFlash("error", error instanceof WishlistApiError ? error.message : "No pudimos quitar el producto. Inténtalo nuevamente.");
    }
  }

  function handleClick(): void {
    if (status === "anonymous") {
      const returnTo = `${window.location.pathname}${window.location.search}` || pathname;
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (!isCustomer || membership.isPending) return;
    if (membership.isError) {
      showFlash("error", "No pudimos consultar tus deseos. Intentaremos nuevamente.");
      void membership.refetch();
      return;
    }
    if (isSaved) setConfirming(true);
    else void save();
  }

  const label = isSaved ? `Quitar ${productName} de deseos` : `Guardar ${productName} en deseos`;
  return <>
    <button
      aria-label={label}
      aria-pressed={isCustomer ? isSaved : undefined}
      className={variant === "icon"
        ? "inline-flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-blue-700 shadow-sm backdrop-blur transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60"
        : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-3 font-bold text-blue-800 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60"}
      disabled={status === "initializing" || (isCustomer && (membership.isPending || isPending)) || (status === "authenticated" && !isCustomer)}
      onClick={handleClick}
      title={status === "authenticated" && !isCustomer ? "Disponible para cuentas de cliente" : label}
      type="button"
    >
      <svg aria-hidden="true" className="size-5" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {variant === "label" ? <span>{isSaved ? "Guardado en deseos" : "Guardar en deseos"}</span> : null}
    </button>
    <ConfirmationDialog
      confirmLabel="Quitar de deseos"
      description={`${productName} dejará de aparecer en tu lista de deseos.`}
      isPending={remove.isPending}
      onCancel={() => setConfirming(false)}
      onConfirm={() => void removeSaved()}
      open={confirming}
      title="¿Quitar este producto?"
    />
  </>;
}
