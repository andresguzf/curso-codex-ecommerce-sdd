import type { Metadata } from "next";

import "./globals.css";
import { StorefrontProviders } from "./providers";

export const metadata: Metadata = {
  title: "Technology Storefront",
  description: "Catálogo público del e-commerce tecnológico.",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body><StorefrontProviders>{children}</StorefrontProviders></body>
    </html>
  );
}
