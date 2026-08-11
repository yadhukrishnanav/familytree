import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the sandbox preview proxy to fetch _next/* assets without warnings
  allowedDevOrigins: [
    "*.space-z.ai",
    "*.chatglm.cn",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
