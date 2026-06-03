import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../config/env";

declare global {
  // eslint-disable-next-line no-var
  var __cevonnePrisma: PrismaClient | undefined;
}

const globalForPrisma = globalThis as typeof globalThis & {
  __cevonnePrisma?: PrismaClient;
};

const createPrismaClient = () => {
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add it to the root .env before using the migrated API."
    );
  }

  const adapter = new PrismaPg({ connectionString: env.databaseUrl });

  return new PrismaClient({
    adapter,
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });
};

const getCachedPrisma = () => globalForPrisma.__cevonnePrisma || null;

export const getPrisma = async () => {
  const cached = getCachedPrisma();
  if (cached) {
    return cached;
  }

  const client = createPrismaClient();

  if (env.nodeEnv !== "production") {
    globalForPrisma.__cevonnePrisma = client;
  }

  return client;
};

export const disconnectPrisma = async () => {
  const cached = getCachedPrisma();
  if (cached) {
    await cached.$disconnect();
    if (globalForPrisma.__cevonnePrisma) {
      delete globalForPrisma.__cevonnePrisma;
    }
  }
};
