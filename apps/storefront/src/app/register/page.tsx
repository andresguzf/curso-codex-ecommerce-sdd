import { StorefrontAuthShell } from "@/features/auth/auth-shell";
import { RegisterForm } from "@/features/auth/register-form";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <StorefrontAuthShell eyebrow="Nueva cuenta" title="Únete a Nexo">
      <Suspense fallback={<p className="mt-8 text-sm text-slate-600">Preparando el registro…</p>}>
        <RegisterForm />
      </Suspense>
    </StorefrontAuthShell>
  );
}
