import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    TZ: 'Australia/Melbourne',
  },
  // Conditional configuration based on environment
  ...(process.env.NODE_ENV === 'production' && process.env.FIREBASE_DEPLOY === 'true' 
    ? {
        // Static export for Firebase hosting deployment
        output: 'export',
        trailingSlash: true,
        images: {
          unoptimized: true,
          domains: ['images.unsplash.com'],
        },
      }
    : {
        // Development configuration with API routes
        output: 'standalone',
        images: {
          formats: ['image/webp', 'image/avif'],
          domains: ['images.unsplash.com'],
        },
      }
  ),
  // Move serverComponentsExternalPackages to root level
  serverExternalPackages: ['firebase-admin'],
  // Performance optimizations
  poweredByHeader: false,
  // Custom webpack configuration to avoid the minification issue
  webpack: (config) => {
    // Completely disable minification to avoid the plugin error
    config.optimization.minimize = false;
    return config;
  },
};

export default nextConfig;
