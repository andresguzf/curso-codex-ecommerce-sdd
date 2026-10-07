import type { Metadata } from "next";
import { themeBootstrapScript } from "@technology-ecommerce/ui";

import { StorefrontShell } from "@/features/layout/storefront-shell";

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
    <html data-design-system="storefront" data-theme="light" lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrapScript("storefront") }} /></head>
      <body>
        <StorefrontProviders>
          <StorefrontShell>{children}</StorefrontShell>
        </StorefrontProviders>
      </body>
    </html>
  );
}
