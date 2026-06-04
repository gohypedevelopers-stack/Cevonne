import { env } from "./env";

const normalizeOrigin = (value = "") => String(value).trim().replace(/\/+$/, "");

const getLocalhostOrigins = () => [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

export const getAllowedOrigins = () =>
  [
    env.frontendUrl,
    ...getLocalhostOrigins(),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

export const isAllowedOrigin = (origin = "") => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return true;
  return getAllowedOrigins().includes(normalized);
};

export const buildCorsHeaders = (origin = "") => {
  if (!isAllowedOrigin(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": normalizeOrigin(origin) || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
};
