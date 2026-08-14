const DEFAULT_SITE_URL = "https://www.cevonne.com";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getSiteUrl() {
  const configuredUrl = process.env.FRONTEND_URL;

  if (!configuredUrl) {
    return DEFAULT_SITE_URL;
  }

  try {
    const url = new URL(configuredUrl);
    const isHttpUrl = url.protocol === "http:" || url.protocol === "https:";
    const isLocalProductionUrl =
      process.env.NODE_ENV === "production" && LOCAL_HOSTNAMES.has(url.hostname);

    if (!isHttpUrl || isLocalProductionUrl) {
      return DEFAULT_SITE_URL;
    }

    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}
