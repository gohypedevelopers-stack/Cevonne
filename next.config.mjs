import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const r2RemotePatterns = [
  { protocol: "https", hostname: "*.r2.dev" },
  { protocol: "https", hostname: "cdn.cevonne.com" },
];

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const configuredSiteOrigin = process.env.FRONTEND_URL || "https://www.cevonne.com";
let siteOrigin = "https://www.cevonne.com";

try {
  siteOrigin = new URL(configuredSiteOrigin).origin;
} catch {
  // Keep the production default if the deployment environment is misconfigured.
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' https://*.supabase.co https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  "font-src 'self' data: https:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://cdn.cevonne.com https://*.r2.dev",
  "media-src 'self' blob: https://cdn.cevonne.com https://*.r2.dev",
  "object-src 'none'",
  // Next.js includes framework bootstrap scripts inline. Rich-text input is separately
  // sanitized on both client and server to keep this compatibility allowance narrow.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL;

if (r2PublicBaseUrl) {
  try {
    const url = new URL(r2PublicBaseUrl);
    r2RemotePatterns.push({
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
    });
  } catch {
    // Ignore invalid env values; local dev can still rely on the wildcard pattern.
  }
}

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  typescript: {
    tsconfigPath: "./tsconfig.next.json",
  },
  images: {
    remotePatterns: r2RemotePatterns,
  },
  turbopack: {
    // Keep module resolution and file watching scoped to this app.
    root: projectRoot,
    resolveAlias: {
      "react-router-dom": "./lib/router.tsx",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Access-Control-Allow-Origin", value: siteOrigin },
        ],
      },
    ];
  },
};

export default nextConfig;
