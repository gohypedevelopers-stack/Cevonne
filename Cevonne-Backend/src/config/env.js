require('dotenv').config();

const trimTrailingSlashes = (value = '') => String(value).trim().replace(/\/+$/, '');

const addScheme = (value = '') => {
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(value)) {
    return `http://${value}`;
  }
  return `https://${value}`;
};

const normalizeOrigin = (value = '') => {
  const normalized = trimTrailingSlashes(value);
  if (!normalized) return '';

  try {
    return new URL(addScheme(normalized)).origin;
  } catch {
    return normalized;
  }
};

const buildOriginVariants = (value = '') => {
  const origin = normalizeOrigin(value);
  if (!origin) return [];

  const origins = new Set([origin]);

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;
    const isLocalHost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

    if (!isLocalHost) {
      const alt = new URL(origin);
      if (hostname.startsWith('www.')) {
        alt.hostname = hostname.replace(/^www\./, '');
        origins.add(alt.origin);
      } else {
        alt.hostname = `www.${hostname}`;
        origins.add(alt.origin);
      }
    }
  } catch {
    // Ignore malformed values and keep the normalized origin only.
  }

  return [...origins];
};

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: normalizeOrigin(process.env.FRONTEND_URL),
  frontendOrigins: buildOriginVariants(process.env.FRONTEND_URL),
};

module.exports = { env };
