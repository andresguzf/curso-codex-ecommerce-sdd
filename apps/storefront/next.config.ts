import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
