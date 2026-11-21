import type { NextConfig } from "next";
import { OPTIMIZED_IMAGE_HOSTS } from "./src/config/images";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  // GramJS (MTProto) opens raw sockets; load it with Node's require, unbundled.
  serverExternalPackages: ["telegram", "big-integer"],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Telegram thumbnails (/api/stream/…) load unoptimized: they sit behind
    // the sign-in gate, which the optimizer's internal fetch can't pass.
    localPatterns: [],
    remotePatterns: OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
