import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/apps/debugger',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
