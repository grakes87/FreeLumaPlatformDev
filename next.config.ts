import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactCompiler disabled — causes infinite Fast Refresh rebuild loop with Turbopack HMR
  // reactCompiler: true,
  serverExternalPackages: ['sequelize', 'mysql2', 'sharp', 'bcryptjs'],
  // Disable server-side minification so Sequelize model class names are preserved
  // (minification renames classes, breaking literal SQL that references model aliases)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }
    return config;
  },
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
