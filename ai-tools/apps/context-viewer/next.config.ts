import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/apps/visualizer',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
