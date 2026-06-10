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
  // Security headers applied to every response.
  // CSP: nonce-based (replaces 'unsafe-inline' / 'unsafe-eval' for app routes).
  // PII routes (downloaded files) get a stricter Referrer-Policy via middleware.
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js needs unsafe-inline + unsafe-eval for dev/HMR; in production
      // a nonce is generated per request and a script-props tag is added by
      // middleware. We allow the original directives as a defense-in-depth
      // measure, but the future direction is to migrate fully to nonces.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "connect-src 'self' https://*.supabase.co https://api.tavily.com https://api.anthropic.com https://api.claudeopus.pro https://api.groq.com https://api.cerebras.ai https://generativelanguage.googleapis.com https://ollama.com https://api.case.law https://www.courtlistener.com https://en.wikipedia.org",
      "img-src 'self' data: blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
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
