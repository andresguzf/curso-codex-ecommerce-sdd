"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AuthApiError } from "@technology-ecommerce/api-client";
import { registerRequestSchema, type RegisterRequest } from "@technology-ecommerce/api-schemas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthField } from "./field";
import { broadcastSessionChange } from "./session-provider";
import { authClient, useSessionStore } from "./session";

export function RegisterForm() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const setNotice = useSessionStore((state) => state.setNotice);
  const [formMessage, setFormMessage] = useState<string>();
  const { formState, handleSubmit, register } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (input) => {
    setFormMessage(undefined);
    try {
      await authClient.register(input);
      const session = await authClient.login({ email: input.email, password: input.password });
      setSession(session);
      setNotice("Cuenta creada y sesión iniciada correctamente.");
      broadcastSessionChange("session-changed");
      router.replace("/account");
    } catch (error) {
      setFormMessage(error instanceof AuthApiError ? error.message : "No pudimos crear la cuenta.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
      <AuthField label="Nombre" autoComplete="name" registration={register("displayName")} error={formState.errors.displayName} />
      <AuthField label="Correo electrónico" type="email" autoComplete="email" registration={register("email")} error={formState.errors.email} />
      <AuthField label="Contraseña" type="password" autoComplete="new-password" registration={register("password")} error={formState.errors.password} />
      <p className="text-xs leading-5 text-slate-500">Usa al menos 12 caracteres. Tu cuenta se creará siempre como cliente.</p>
      <div aria-live="polite" aria-atomic="true" className="min-h-6 text-sm font-medium text-red-700">{formMessage}</div>
      <button disabled={formState.isSubmitting} className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-bold text-white transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60">
        {formState.isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
      </button>
      <p className="text-center text-sm text-slate-600">¿Ya tienes cuenta? <Link href="/login" className="font-bold text-indigo-700 underline-offset-4 hover:underline">Inicia sesión</Link></p>
    </form>
  );
}
