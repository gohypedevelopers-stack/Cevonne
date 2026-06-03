/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      "react-router-dom": "./lib/router.tsx",
    },
  },
};

export default nextConfig;
