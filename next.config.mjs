/** @type {import('next').NextConfig} */
const backendUrl = (process.env.BACKEND_URL || process.env.VITE_APP_BACKEND_URL || "").replace(/\/$/, "");

const nextConfig = {
  turbopack: {
    resolveAlias: {
      "react-router-dom": "./lib/router.tsx",
    },
  },
  async rewrites() {
    if (!backendUrl) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
