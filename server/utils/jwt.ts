import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env";

type JwtSignOptions = Pick<SignOptions, "expiresIn">;

const defaultSignOptions: JwtSignOptions = {};
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const getJwtSecret = () => {
  const secret = env.jwtSecret.trim();
  if (!secret) {
    throw new Error("JWT_SECRET must be configured before authentication can be used.");
  }
  return secret;
};

export const signToken = (
  payload: string | object | Buffer,
  options: JwtSignOptions = defaultSignOptions
) =>
  jwt.sign(payload, getJwtSecret(), {
    expiresIn: options.expiresIn ?? "8h",
  });

export const verifyToken = (token: string) => jwt.verify(token, getJwtSecret());

export default {
  signToken,
  verifyToken,
};
