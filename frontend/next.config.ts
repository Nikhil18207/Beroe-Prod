import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  typescript: {
    // Allow production builds even with type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow production builds even with lint errors
    ignoreDuringBuilds: true,
  },
  // Output configuration for deployment
  output: 'standalone',
};

export default nextConfig;
