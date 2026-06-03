const toNumber = (value: string | number | null | undefined, fallback: number | undefined = undefined) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | boolean | null | undefined, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

export const env = Object.freeze({
  port: toNumber(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "dev_secret",
  frontendUrl: process.env.FRONTEND_URL || "",
  backendUrl: process.env.BACKEND_URL || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: toNumber(process.env.SMTP_PORT, undefined),
  smtpUser: process.env.SMTP_USER || "",
  emailFrom: process.env.EMAIL_FROM || "",
  googleAppKey: process.env.GOOGLE_APP_KEY || "",
  isProduction: process.env.NODE_ENV === "production",
  isVercel: toBoolean(process.env.VERCEL, false),
});

export const requireEnv = (name: string, value: string | undefined = process.env[name]) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};
