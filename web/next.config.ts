import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: '/portal',
        destination: process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3001',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
