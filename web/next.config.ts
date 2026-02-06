import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: '/portal',
        destination: process.env.NEXT_PUBLIC_PORTAL_URL || (process.env.NODE_ENV === 'production' ? 'https://labgest-portal.vercel.app' : 'http://localhost:3001'),
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
