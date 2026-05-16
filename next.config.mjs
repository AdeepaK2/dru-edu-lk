import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TZ: 'Australia/Melbourne',
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  ...(process.env.NODE_ENV === 'production' && process.env.FIREBASE_DEPLOY === 'true'
    ? {
        output: 'export',
        trailingSlash: true,
        images: {
          unoptimized: true,
          remotePatterns: [
            {
              protocol: 'https',
              hostname: 'images.unsplash.com',
            },
          ],
        },
      }
    : {
        output: 'standalone',
        images: {
          formats: ['image/webp', 'image/avif'],
          remotePatterns: [
            {
              protocol: 'https',
              hostname: 'images.unsplash.com',
            },
          ],
        },
      }),
  serverExternalPackages: ['firebase-admin', 'tldraw'],
  poweredByHeader: false,
  webpack: (config) => {
    config.optimization.minimize = false;
    return config;
  },
};

export default nextConfig;
