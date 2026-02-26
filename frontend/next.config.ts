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

  // ============================================================================
  // PERFORMANCE OPTIMIZATIONS
  // ============================================================================

  // Enable React Strict Mode for better performance patterns
  reactStrictMode: true,

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Experimental features for better performance
  experimental: {
    // Optimize package imports - tree shake large packages
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'framer-motion',
      'lodash',
      'date-fns',
      'recharts',
    ],
  },

  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    // Only apply in production
    if (!dev) {
      // Enable module concatenation for smaller bundles
      config.optimization.concatenateModules = true;
    }

    // Reduce resolution overhead
    config.resolve.symlinks = false;

    return config;
  },

  // Headers for caching static assets
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|gif|ico|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Reduce powered by header
  poweredByHeader: false,

  // Generate ETags for caching
  generateEtags: true,

  // Compress responses
  compress: true,
};

export default nextConfig;
