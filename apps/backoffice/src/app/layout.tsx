import type { Metadata } from "next";

import "./globals.css";
import { SessionProvider } from "@/features/auth/session-provider";

export const metadata: Metadata = {
  title: "Technology Backoffice",
  description: "Administración del e-commerce tecnológico.",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body><SessionProvider>{children}</SessionProvider></body>
    </html>
  );
}
