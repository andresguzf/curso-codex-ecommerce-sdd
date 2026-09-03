import { StorefrontAuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return <StorefrontAuthShell eyebrow="Acceso de cliente" title="Bienvenido de vuelta"><LoginForm /></StorefrontAuthShell>;
}
