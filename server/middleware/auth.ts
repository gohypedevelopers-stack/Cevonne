import type { NextFunction, Request, Response } from "express";

const { getPrisma } = require("../db/prismaClient");
const { verifyToken } = require("../utils/jwt");

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
    if (!decoded?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const prisma = await getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, name: true },
    });

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
