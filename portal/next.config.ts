import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ['@labgest/shared'],
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
