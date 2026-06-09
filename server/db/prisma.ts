import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient } from "@prisma/client";

import { env } from "../config/env";

const require = createRequire(import.meta.url);
const generatedClientSchemaPath = path.join(process.cwd(), "node_modules", ".prisma", "client", "schema.prisma");

declare global {
  var __cevonnePrisma: PrismaClient | undefined;
  var __cevonnePrismaSignature: string | undefined;
}

const globalForPrisma = globalThis as typeof globalThis & {
  __cevonnePrisma?: PrismaClient;
  __cevonnePrismaSignature?: string;
};

const clearCachedPrismaClientModules = () => {
  for (const modulePath of Object.keys(require.cache)) {
    if (
      modulePath.includes(`${path.sep}node_modules${path.sep}@prisma${path.sep}client`) ||
      modulePath.includes(`${path.sep}node_modules${path.sep}.prisma${path.sep}client`)
    ) {
      delete require.cache[modulePath];
    }
  }
};

const getGeneratedClientSignature = async () => {
  try {
    const stats = await fs.stat(generatedClientSchemaPath);
    return `${stats.mtimeMs}:${stats.size}`;
  } catch {
    return null;
  }
};

const loadPrismaClient = () => {
  clearCachedPrismaClientModules();
  const prismaClientModule = require("@prisma/client") as typeof import("@prisma/client");
  return prismaClientModule.PrismaClient;
};

const createPrismaClient = () => {
  if (!env.databaseUrl) {
    throw new Error(
      "No database URL is configured. Set DATABASE_URL or a supported production database env before using the API."
    );
  }

  const PrismaClient = loadPrismaClient();
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });

  return new PrismaClient({
    adapter,
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });
};

const getCachedPrisma = () => globalForPrisma.__cevonnePrisma || null;

export const getPrisma = async () => {
  const generatedClientSignature = await getGeneratedClientSignature();
  const cached = getCachedPrisma();
  if (cached && globalForPrisma.__cevonnePrismaSignature === generatedClientSignature) {
    return cached;
  }

  if (cached) {
    await cached.$disconnect().catch(() => undefined);
    delete globalForPrisma.__cevonnePrisma;
    delete globalForPrisma.__cevonnePrismaSignature;
  }

  const client = createPrismaClient();
  globalForPrisma.__cevonnePrisma = client;
  globalForPrisma.__cevonnePrismaSignature = generatedClientSignature ?? undefined;

  return client;
};

export const disconnectPrisma = async () => {
  const cached = getCachedPrisma();
  if (cached) {
    await cached.$disconnect();
    if (globalForPrisma.__cevonnePrisma) {
      delete globalForPrisma.__cevonnePrisma;
    }
    if (globalForPrisma.__cevonnePrismaSignature) {
      delete globalForPrisma.__cevonnePrismaSignature;
    }
  }
};
