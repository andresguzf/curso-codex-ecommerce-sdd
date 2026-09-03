import { StorefrontAuthShell } from "@/features/auth/auth-shell";
import { RegisterForm } from "@/features/auth/register-form";

export default function RegisterPage() {
  return <StorefrontAuthShell eyebrow="Nueva cuenta" title="Únete a Nexo"><RegisterForm /></StorefrontAuthShell>;
}
