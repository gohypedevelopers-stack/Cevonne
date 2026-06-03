import path from "node:path";
import { mkdir } from "node:fs/promises";

import { DEFAULT_LIMITS } from "./constants.js";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
export const UPLOADS_PUBLIC_PATH = "/uploads";
export const UPLOAD_MAX_BYTES = DEFAULT_LIMITS.uploadMaxBytes;

export const ensureUploadsDir = async () => {
  await mkdir(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
};

export const buildUploadUrl = (requestUrl, filename) => {
  const baseUrl = new URL(requestUrl);
  return `${baseUrl.origin}${UPLOADS_PUBLIC_PATH}/${filename}`;
};
