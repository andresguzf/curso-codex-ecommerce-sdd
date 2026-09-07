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
