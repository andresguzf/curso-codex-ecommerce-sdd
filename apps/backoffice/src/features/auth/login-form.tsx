"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AuthApiError } from "@technology-ecommerce/api-client";
import { loginRequestSchema, type LoginRequest } from "@technology-ecommerce/api-schemas";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { backofficeDestinationFor, authClient, isBackofficeRole, useSessionStore } from "./session";
import { broadcastSessionChange } from "./session-provider";

export function BackofficeLoginForm() {
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const setNotice = useSessionStore((state) => state.setNotice);
  const notice = useSessionStore((state) => state.notice);
  const [message, setMessage] = useState<string>();
  const { formState, handleSubmit, register } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (input) => {
    setMessage(undefined);
    setNotice(null);
    try {
      const session = await authClient.login(input);
      if (!isBackofficeRole(session.user.role)) {
        window.location.assign(backofficeDestinationFor(session.user.role));
        return;
      }
      setSession(session);
      setNotice("Sesión administrativa iniciada correctamente.");
      broadcastSessionChange("session-changed");
      router.replace(backofficeDestinationFor(session.user.role));
    } catch (error) {
      setMessage(error instanceof AuthApiError ? error.message : "No pudimos iniciar la sesión.");
    }
  });

  const fieldClass = "w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 text-base outline-none transition focus:border-blue-600 focus:ring-0 aria-invalid:border-red-600";
  return (
    <form onSubmit={onSubmit} noValidate className="mt-9 space-y-7">
      <div>
        <label htmlFor="email" className="block text-xs font-bold tracking-[.12em] text-slate-500 uppercase">Correo corporativo</label>
        <input id="email" type="email" autoComplete="email" {...register("email")} aria-invalid={Boolean(formState.errors.email)} aria-describedby={formState.errors.email ? "email-error" : undefined} className={fieldClass} />
        {formState.errors.email ? <p id="email-error" role="alert" className="mt-2 text-sm text-red-700">{formState.errors.email.message}</p> : null}
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-bold tracking-[.12em] text-slate-500 uppercase">Contraseña</label>
        <input id="password" type="password" autoComplete="current-password" {...register("password")} aria-invalid={Boolean(formState.errors.password)} aria-describedby={formState.errors.password ? "password-error" : undefined} className={fieldClass} />
        {formState.errors.password ? <p id="password-error" role="alert" className="mt-2 text-sm text-red-700">{formState.errors.password.message}</p> : null}
      </div>
      <div aria-live="polite" aria-atomic="true" className={`min-h-6 text-sm font-medium ${message ? "text-red-700" : "text-blue-700"}`}>{message ?? notice}</div>
      <button disabled={formState.isSubmitting} className="flex w-full items-center justify-between rounded-lg bg-[#15345b] px-5 py-4 font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60">
        <span>{formState.isSubmitting ? "Validando acceso…" : "Entrar al panel"}</span><span aria-hidden="true">→</span>
      </button>
      <p className="text-sm leading-6 text-slate-500">El acceso está reservado a administración y facturación. Las cuentas de clientes continúan en la tienda.</p>
    </form>
  );
}
