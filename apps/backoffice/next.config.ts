import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  distDir: process.env.E2E_NEXT_DIST_DIR ?? ".next",
  // Vercel packages its own functions; standalone is for self-hosted builds.
  output: process.env.VERCEL === "1" ? undefined : "standalone",
  outputFileTracingRoot: workspaceRoot,
  async rewrites() {
    const origin = process.env.API_REST_ORIGIN;
    if (!origin) {
      if (process.env.VERCEL === "1") throw new Error("API_REST_ORIGIN is required on Vercel");
      return [];
    }
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password) {
      throw new Error("API_REST_ORIGIN must be an HTTPS origin without credentials or path");
    }
    return [{ source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` }];
  },
};

export default nextConfig;
