import type { AuthResponse, PublicUser } from "@/types/user";
import crypto from "node:crypto";

import { signToken } from "../utils/jwt";

export const sanitizeUser = (user: any): PublicUser | null => {
  if (!user) return null;
  const { passwordHash, otp, otpExpiresAt, ...rest } = user;
  return rest;
};

export const buildAuthResponse = (user: any): AuthResponse => ({
  user: sanitizeUser(user),
  token: signToken({ id: user.id, role: user.role, email: user.email ?? null, name: user.name ?? null }),
});

export const createOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export const createPasswordHashSeed = () =>
  crypto.randomBytes(16).toString("hex");
