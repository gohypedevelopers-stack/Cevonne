const TRAILING_SLASH_RE = /\/+$/;
const ABSOLUTE_URL_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

const stripTrailingSlash = (value) => String(value ?? "").trim().replace(TRAILING_SLASH_RE, "");

export const normalizeOriginUrl = (value) => {
  const sanitized = stripTrailingSlash(value);

  if (!sanitized) {
    return "";
  }

  if (ABSOLUTE_URL_RE.test(sanitized)) {
    return sanitized;
  }

  if (
    sanitized.startsWith("localhost") ||
    sanitized.startsWith("127.0.0.1") ||
    sanitized.startsWith("[::1]") ||
    sanitized.startsWith("::1")
  ) {
    return `http://${sanitized}`;
  }

  return `https://${sanitized}`;
};
