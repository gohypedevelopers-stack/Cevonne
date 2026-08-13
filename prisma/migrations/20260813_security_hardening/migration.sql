ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "SecurityRateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityRateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "SecurityRateLimit_resetAt_idx" ON "SecurityRateLimit"("resetAt");
