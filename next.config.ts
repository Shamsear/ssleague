import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // During builds, only run ESLint on specific directories
    dirs: ['app', 'components', 'lib'],
    // Don't fail the build if there are ESLint warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail the build if there are TypeScript errors during production build
    ignoreBuildErrors: true,
  },
  images: {
    // Enable image optimization
    formats: ['image/avif', 'image/webp'],
    // Add caching for better performance
    minimumCacheTTL: 60,
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for different use cases
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Allow images from Firebase Storage and other domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Exclude sql.js from server-side bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
