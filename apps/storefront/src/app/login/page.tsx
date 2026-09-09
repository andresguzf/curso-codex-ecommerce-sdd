import { StorefrontAuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <StorefrontAuthShell eyebrow="Acceso de cliente" title="Bienvenido de vuelta">
      <Suspense fallback={<p className="mt-8 text-sm text-slate-600">Preparando el acceso…</p>}>
        <LoginForm />
      </Suspense>
    </StorefrontAuthShell>
  );
}
