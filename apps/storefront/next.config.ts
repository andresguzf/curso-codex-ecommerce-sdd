import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  images: {
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
        pathname: "/**",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
