import dotenv from "dotenv";

import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local" });
dotenv.config();

const normalizeDatabaseUrl = (value) => {
  const raw = value?.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      return raw;
    }

    const hostname = parsed.hostname.toLowerCase();
    const isNeonPoolerHost = hostname.endsWith(".neon.tech") && hostname.includes("-pooler.");
    if (isNeonPoolerHost) {
      const existingOptions = parsed.searchParams.get("options")?.trim();

      if (existingOptions) {
        const cleanedOptions = existingOptions
          .split(/\s+/)
          .filter((token) => token && !/^project=/i.test(token) && !/^endpoint=/i.test(token))
          .join(" ");

        if (cleanedOptions) {
          parsed.searchParams.set("options", cleanedOptions);
        } else {
          parsed.searchParams.delete("options");
        }
      }
    }

    return parsed.toString();
  } catch {
    return raw;
  }
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: normalizeDatabaseUrl(process.env.DIRECT_URL || process.env.DATABASE_URL),
  },
});
