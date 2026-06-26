import "dotenv/config";

import { defineConfig } from "prisma/config";

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

    if (parsed.searchParams.get("uselibpqcompat") === "true") {
      return parsed.toString();
    }

    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
      parsed.searchParams.set("sslmode", "verify-full");
    }

    return parsed.toString();
  } catch {
    return raw;
  }
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: normalizeDatabaseUrl(process.env.DATABASE_URL),
  },
});
