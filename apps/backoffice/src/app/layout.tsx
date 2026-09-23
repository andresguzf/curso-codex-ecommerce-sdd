import type { Metadata } from "next";

import { BackofficeShell } from "@/features/layout/backoffice-shell";

import "./globals.css";
import { Providers } from "./providers";

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
      <body>
        <Providers>
          <BackofficeShell>{children}</BackofficeShell>
        </Providers>
      </body>
    </html>
  );
}
