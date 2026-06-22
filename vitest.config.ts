import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${rootDir}/`,
      },
      {
        find: "react-router-dom",
        replacement: path.join(rootDir, "lib/router.tsx"),
      },
    ],
  },
});
