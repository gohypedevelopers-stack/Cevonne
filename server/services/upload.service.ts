import fs from "node:fs";
import path from "node:path";

import { env } from "../config/env";
import { UPLOADS_DIR } from "../config/upload";

export { UPLOADS_DIR, ensureUploadsDir } from "../config/upload";

export const buildUploadUrl = (requestUrl: string, filename: string) => {
  const baseUrl = env.frontendUrl ? new URL(env.frontendUrl) : new URL(requestUrl);
  return `${baseUrl.origin}/uploads/${filename}`;
};

export const ensureUploadFileExists = (filename: string) =>
  fs.existsSync(path.join(UPLOADS_DIR, filename));

export const removeUploadFile = (filename: string) => {
  const filepath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
};
