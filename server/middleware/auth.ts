import type { NextFunction, Request, Response } from "express";

const { getPrisma } = require("../db/prismaClient");
const { verifyToken } = require("../utils/jwt");

const canFallbackToTokenClaims = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  const message =
    typeof error === "object" && error !== null && "message" in error ? String((error as { message?: unknown }).message) : String(error ?? "");

  return code === "P1001" || /can't reach database server|databasenotreachable/i.test(message);
};

const buildTokenAuthUser = (decoded: { id?: string; role?: string; email?: string | null; name?: string | null }) => {
  if (typeof decoded?.id !== "string" || !decoded.id.trim()) {
    return null;
  }

  if (typeof decoded?.role !== "string" || !decoded.role.trim()) {
    return null;
  }

  return {
    id: decoded.id.trim(),
    email: typeof decoded.email === "string" && decoded.email.trim() ? decoded.email.trim() : null,
    role: decoded.role.trim(),
    name: typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim() : null,
  };
};

const parseToken = (header = "") => {
  const [scheme, token] = String(header).split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
};

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = parseToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = verifyToken(token);
    const fallbackUser = buildTokenAuthUser(decoded);
    if (!fallbackUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let user = null;
    try {
      const prisma = await getPrisma();
      user = await prisma.user.findUnique({
        where: { id: fallbackUser.id },
        select: { id: true, email: true, role: true, name: true },
      });
    } catch (error) {
      if (!canFallbackToTokenClaims(error)) {
        throw error;
      }

      console.warn("protect: falling back to JWT claims because the database is unreachable.");
      user = fallbackUser;
    }

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireRole =
  (...roles: Array<string>) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
