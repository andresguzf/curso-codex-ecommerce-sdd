import type { Metadata } from "next";
import { themeBootstrapScript } from "@technology-ecommerce/ui";

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
    <html data-design-system="backoffice" lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrapScript("backoffice") }} /></head>
      <body>
        <Providers>
          <BackofficeShell>{children}</BackofficeShell>
        </Providers>
      </body>
    </html>
  );
}
