import { createHash } from "node:crypto";
import { getPrisma } from "@/server/db/prismaClient";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  identifier?: string | null;
};

let lastCleanupAt = 0;

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 24);

const cleanExpiredBuckets = async (now: number) => {
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  const prisma = await getPrisma();
  await prisma.securityRateLimit.deleteMany({
    where: { resetAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
  });
};

export const getClientIp = (request: Request) => {
  const candidateHeaders = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for"),
  ];

  for (const value of candidateHeaders) {
    const ip = value?.split(",")[0]?.trim();
    if (ip) return ip;
  }

  return "unknown";
};

export const consumeRateLimit = async (request: Request, scope: string, options: RateLimitOptions) => {
  const now = Date.now();
  const identity = `${getClientIp(request)}|${options.identifier?.trim().toLowerCase() || ""}`;
  const key = `${scope}:${hash(identity)}`;

  try {
    const prisma = await getPrisma();
    await cleanExpiredBuckets(now);

    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.securityRateLimit.findUnique({ where: { key } });
      const resetAt = new Date(now + options.windowMs);

      if (!existing || existing.resetAt.getTime() <= now) {
        if (existing) {
          await transaction.securityRateLimit.update({ where: { key }, data: { count: 1, resetAt } });
        } else {
          await transaction.securityRateLimit.create({ data: { key, count: 1, resetAt } });
        }
        return { allowed: true as const, retryAfterSeconds: 0 };
      }

      const updated = await transaction.securityRateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });

      if (updated.count <= options.limit) {
        return { allowed: true as const, retryAfterSeconds: 0 };
      }

      return {
        allowed: false as const,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt.getTime() - now) / 1000)),
      };
    });
  } catch {
    // Security controls fail closed if their backing store is unavailable.
    return { allowed: false as const, retryAfterSeconds: 60 };
  }
};
