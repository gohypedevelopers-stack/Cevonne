import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env";

type JwtSignOptions = Pick<SignOptions, "expiresIn">;

const defaultSignOptions: JwtSignOptions = {};
const jwtSecret = env.jwtSecret;

export const signToken = (
  payload: string | object | Buffer,
  options: JwtSignOptions = defaultSignOptions
) =>
  jwt.sign(payload, jwtSecret, {
    expiresIn: options.expiresIn ?? "30d",
  });

export const verifyToken = (token: string) => jwt.verify(token, jwtSecret);

export default {
  signToken,
  verifyToken,
};
