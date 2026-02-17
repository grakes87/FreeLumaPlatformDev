import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler disabled — causes infinite Fast Refresh rebuild loop with Turbopack HMR
  // reactCompiler: true,
  serverExternalPackages: ['sequelize', 'mysql2', 'sharp', 'bcryptjs'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.backblazeb2.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.freeluma.app',
      },
    ],
  },
};

export default nextConfig;
