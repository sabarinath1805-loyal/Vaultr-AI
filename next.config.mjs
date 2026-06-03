import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT || "standalone",
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  reactStrictMode: false,
  productionBrowserSourceMaps: false,
  turbopack: {
    root: __dirname,
  },
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        perf_hooks: false,
      };
    }
    if (dev) {
      config.devtool = "eval";
      config.optimization = {
        ...config.optimization,
        splitChunks: { maxSize: 200000 },
        removeAvailableModules: false,
        removeEmptyChunks: false,
      };
    }
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
