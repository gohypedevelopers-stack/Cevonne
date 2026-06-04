const LEGACY_UPLOAD_ORIGINS = new Set([
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "https://cevonneapi.vercel.app",
]);

const trimAssetUrl = (value = "") => String(value).trim().split("?")[0].split("#")[0];

export const normalizeUploadedAssetUrl = (value?: string | null) => {
  if (value === undefined || value === null) return value ?? undefined;

  const clean = trimAssetUrl(value);
  if (!clean) return clean;

  if (clean.startsWith("/uploads/")) {
    return clean;
  }

  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      if (LEGACY_UPLOAD_ORIGINS.has(url.origin) || url.pathname.startsWith("/uploads/")) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return clean;
    }
  }

  return clean;
};
