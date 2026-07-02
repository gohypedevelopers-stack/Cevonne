import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient } from "@prisma/client";

import { env } from "../config/env";
import { createHttpError } from "../http/errors";

const require = createRequire(import.meta.url);
const generatedClientSchemaPath = path.join(process.cwd(), "node_modules", ".prisma", "client", "schema.prisma");
const PRISMA_CONNECT_TIMEOUT_MS = 5_000;
const PRISMA_IDLE_TIMEOUT_MS = 300_000;
const PRISMA_INIT_ATTEMPTS = 4;
const PRISMA_RETRY_DELAY_MS = 1_500;

declare global {
  var __cevonnePrisma: PrismaClient | undefined;
  var __cevonnePrismaSignature: string | undefined;
  var __cevonnePrismaInitPromise: Promise<PrismaClient> | undefined;
}

const globalForPrisma = globalThis as typeof globalThis & {
  __cevonnePrisma?: PrismaClient;
  __cevonnePrismaSignature?: string;
  __cevonnePrismaInitPromise?: Promise<PrismaClient>;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }

  return String(error ?? "");
};

const getErrorCode = (error: unknown) => {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }

  return "";
};

const isNeonConnectionStringMismatch = (error: unknown) => {
  const message = `${getErrorMessage(error)} ${getErrorCode(error)}`;

  return /inconsistent project name inferred from sni|project option|endpoint option|options=project|options=endpoint/i.test(
    message
  );
};

const isRetryablePrismaConnectionError = (error: unknown) => {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (["P1001", "P1002", "P1017"].includes(code)) {
    return true;
  }

  return /control plane request failed|can't reach database server|database server is starting up|the database system is starting up|timeout expired|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|server closed the connection unexpectedly|connection terminated unexpectedly|temporary failure/i.test(
    message
  );
};

const createDatabaseUnavailableError = (cause: unknown) => {
  if (isNeonConnectionStringMismatch(cause)) {
    return createHttpError(
      503,
      "Neon connection string is invalid or mismatched. Use the pooled DATABASE_URL for runtime queries, put the direct Neon string in DIRECT_URL for Prisma migrations, and remove any stale options=project=... or options=endpoint=... fragment from the pooled URL.",
      {
        cause,
        expose: true,
      }
    );
  }

  return createHttpError(503, "Database temporarily unavailable. Please try again in a moment.", {
    cause,
    expose: true,
  });
};

const createPrismaClient = () => {
  if (!env.databaseUrl) {
    throw new Error(
      "No runtime database URL is configured. Set DATABASE_URL to the pooled Neon connection string. Use DIRECT_URL only for Prisma CLI and migrations."
    );
  }

  const PrismaClient = loadPrismaClient();
  const adapter = new PrismaPg({
    connectionString: env.databaseUrl,
    connectionTimeoutMillis: PRISMA_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: PRISMA_IDLE_TIMEOUT_MS,
  });

  return new PrismaClient({
    adapter,
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });
};

const initializePrismaClient = async () => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PRISMA_INIT_ATTEMPTS; attempt += 1) {
    const client = createPrismaClient();

    try {
      await client.$connect();
      await client.$queryRawUnsafe("SELECT 1");
      return client;
    } catch (error) {
      lastError = error;
      await client.$disconnect().catch(() => undefined);

      if (!isRetryablePrismaConnectionError(error) || attempt === PRISMA_INIT_ATTEMPTS) {
        break;
      }

      await sleep(PRISMA_RETRY_DELAY_MS * attempt);
    }
  }

  throw createDatabaseUnavailableError(lastError);
};

const getCachedPrisma = () => globalForPrisma.__cevonnePrisma || null;

export const getPrisma = async () => {
  const generatedClientSignature = await getGeneratedClientSignature();
  const normalizedSignature = generatedClientSignature ?? undefined;
  const cached = getCachedPrisma();
  if (cached && globalForPrisma.__cevonnePrismaSignature === normalizedSignature) {
    return cached;
  }

  if (cached) {
    await cached.$disconnect().catch(() => undefined);
    delete globalForPrisma.__cevonnePrisma;
    delete globalForPrisma.__cevonnePrismaSignature;
  }

  if (globalForPrisma.__cevonnePrismaInitPromise) {
    return globalForPrisma.__cevonnePrismaInitPromise;
  }

  const initPromise = initializePrismaClient();
  globalForPrisma.__cevonnePrismaInitPromise = initPromise;

  try {
    const client = await initPromise;
    globalForPrisma.__cevonnePrisma = client;
    globalForPrisma.__cevonnePrismaSignature = normalizedSignature;
    return client;
  } finally {
    if (globalForPrisma.__cevonnePrismaInitPromise === initPromise) {
      delete globalForPrisma.__cevonnePrismaInitPromise;
    }
  }
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

  if (globalForPrisma.__cevonnePrismaInitPromise) {
    delete globalForPrisma.__cevonnePrismaInitPromise;
  }
};
