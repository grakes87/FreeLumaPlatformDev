import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ['sequelize', 'mysql2', 'sharp', 'bcryptjs'],
};

export default nextConfig;
