import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The recommender runs entirely on the local machine; no remote images are used.
  images: { remotePatterns: [] },
};

export default nextConfig;
