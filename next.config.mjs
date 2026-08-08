import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const r2RemotePatterns = [{ protocol: "https", hostname: "*.r2.dev" }];

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

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
};

export default nextConfig;
