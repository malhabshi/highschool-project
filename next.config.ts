import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root so Next.js ignores unrelated lockfiles elsewhere.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
