import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  distDir: process.env.E2E_NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  images: {
    // The development adapter serves images from localhost. Never relax the
    // private-network restriction in production or follow local redirects.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    maximumRedirects: process.env.NODE_ENV === "development" ? 0 : 3,
    remotePatterns: [
      {
        hostname: "picsum.photos",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "localhost",
        pathname: "/api/v1/media/images/**",
        port: "3001",
        protocol: "http",
      },
      {
        hostname: "images.unsplash.com",
        pathname: "/**",
        protocol: "https",
      },
      {
        hostname: "res.cloudinary.com",
        pathname: "/*/image/upload/v*/codex-storefront/*",
        port: "",
        search: "",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
