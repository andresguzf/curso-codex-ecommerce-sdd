"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AuthApiError } from "@technology-ecommerce/api-client";
import { loginRequestSchema, type LoginRequest } from "@technology-ecommerce/api-schemas";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthField } from "./field";
import { broadcastSessionChange } from "./session-provider";
import { claimAnonymousCart } from "../cart/cart-api";
import { authClient, isExternalDestination, safeStorefrontReturnTo, storefrontDestinationFor, useSessionStore } from "./session";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setSession = useSessionStore((state) => state.setSession);
  const setNotice = useSessionStore((state) => state.setNotice);
  const [formMessage, setFormMessage] = useState<string>();
  const { formState, handleSubmit, register } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (input) => {
    setFormMessage(undefined);
    try {
      const session = await authClient.login(input);
      const claim = session.user.role === "CUSTOMER"
        ? await claimAnonymousCart(session.accessToken)
        : null;
      setSession(session);
      setNotice(
        claim?.adjustedProductIds.length
          ? "Sesión iniciada. Ajustamos algunas cantidades del carrito al stock disponible."
          : "Sesión iniciada correctamente.",
      );
      broadcastSessionChange("session-changed");
      const destination = session.user.role === "CUSTOMER"
        ? safeStorefrontReturnTo(searchParams.get("returnTo"))
        : storefrontDestinationFor(session.user.role);
      if (isExternalDestination(destination)) window.location.assign(destination);
      else router.replace(destination);
    } catch (error) {
      setFormMessage(error instanceof AuthApiError ? error.message : "No pudimos iniciar la sesión.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
      <AuthField label="Correo electrónico" type="email" autoComplete="email" registration={register("email")} error={formState.errors.email} />
      <AuthField label="Contraseña" type="password" autoComplete="current-password" registration={register("password")} error={formState.errors.password} />
      <div aria-live="polite" aria-atomic="true" className="min-h-6 text-sm font-medium text-red-700">{formMessage}</div>
      <button disabled={formState.isSubmitting} className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-bold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60">
        {formState.isSubmitting ? "Verificando…" : "Iniciar sesión"}
      </button>
      <p className="text-center text-sm text-slate-600">¿Primera vez? <Link href={searchParams.get("returnTo") ? `/register?returnTo=${encodeURIComponent(searchParams.get("returnTo")!)}` : "/register"} className="font-bold text-indigo-700 underline-offset-4 hover:underline">Crea tu cuenta</Link></p>
    </form>
  );
}
