const DEFAULT_LOCAL_API_BASE = "http://localhost:5000/api";

const trimTrailingSlashes = (value = "") => String(value).trim().replace(/\/+$/, "");

const isLocalHost = (hostname = "") =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

const isLocalPage = () => {
  if (typeof window === "undefined") return false;
  return isLocalHost(window.location.hostname);
};

const addScheme = (value) => {
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(value)) {
    return `http://${value}`;
  }
  return `https://${value}`;
};

const normalizeApiBase = (value) => {
  const normalized = trimTrailingSlashes(value);
  if (!normalized) return DEFAULT_LOCAL_API_BASE;
  const withScheme = addScheme(normalized);
  return /\/api$/i.test(withScheme) ? withScheme : `${withScheme}/api`;
};

const shouldPreferLocalBackend = (value) => {
  if (!isLocalPage()) return false;
  const normalized = trimTrailingSlashes(value);
  if (!normalized) return true;

  try {
    const parsed = new URL(addScheme(normalized));
    return !isLocalHost(parsed.hostname);
  } catch {
    return true;
  }
};

const RAW_API_BASE = (import.meta.env.VITE_APP_BACKEND_URL || "").trim();

export const resolveApiBase = (value = RAW_API_BASE) =>
  shouldPreferLocalBackend(value) ? DEFAULT_LOCAL_API_BASE : normalizeApiBase(value);

export const API_BASE = resolveApiBase(RAW_API_BASE);
export const HAS_API_BASE = Boolean(RAW_API_BASE) || isLocalPage();
export const getApiBase = () => resolveApiBase(RAW_API_BASE);
