import type { NextFunction, Request, Response } from "express";
import { USER_ROLES, type SessionUser, type UserRole } from "../../types/user";

const { getPrisma } = require("../db/prismaClient");
const { verifyToken } = require("../utils/jwt");

const USER_ROLE_SET = new Set<UserRole>(USER_ROLES);

const buildTokenAuthUser = (decoded: { id?: string; role?: string; email?: string | null; name?: string | null; sv?: number }): (SessionUser & { sessionVersion: number }) | null => {
  if (typeof decoded?.id !== "string" || !decoded.id.trim()) {
    return null;
  }

  if (typeof decoded?.role !== "string" || !decoded.role.trim()) {
    return null;
  }

  const normalizedRole = decoded.role.trim().toUpperCase();
  if (!USER_ROLE_SET.has(normalizedRole as UserRole)) {
    return null;
  }

  if (!Number.isInteger(decoded.sv) || (decoded.sv ?? 0) < 0) {
    return null;
  }

  return {
    id: decoded.id.trim(),
    email: typeof decoded.email === "string" && decoded.email.trim() ? decoded.email.trim() : "",
    role: normalizedRole as UserRole,
    name: typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim() : null,
    sessionVersion: decoded.sv as number,
  };
};

const parseToken = (cookieHeader = "") => {
  const cookie = String(cookieHeader)
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("cevonne_session="));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice("cevonne_session=".length));
  } catch {
    return null;
  }
};

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = parseToken(req.headers.cookie);
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = verifyToken(token);
    const fallbackUser = buildTokenAuthUser(decoded);
    if (!fallbackUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: fallbackUser.id },
      select: { id: true, email: true, role: true, name: true, sessionVersion: true },
    });

    if (!user || user.sessionVersion !== fallbackUser.sessionVersion) {
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
