import path from "node:path";
import { mkdir } from "node:fs/promises";

import { DEFAULT_LIMITS } from "./constants";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
export const UPLOADS_PUBLIC_PATH = "/uploads";
export const UPLOAD_MAX_BYTES = DEFAULT_LIMITS.uploadMaxBytes;
export const COLLECTION_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export const ensureUploadsDir = async () => {
  await mkdir(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
};

export const buildUploadUrl = (_requestUrl, filename) => `${UPLOADS_PUBLIC_PATH}/${filename}`;
