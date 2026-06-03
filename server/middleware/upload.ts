import crypto from "node:crypto";
import path from "node:path";

import multer from "multer";

import { env } from "../config/env";
import { ensureUploadsDir, UPLOAD_MAX_BYTES, UPLOADS_DIR } from "../config/upload";

const isVercel = Boolean(process.env.VERCEL);

export const createUploadMiddleware = () => {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const unique = crypto.randomUUID();
      cb(null, `${name}-${unique}${ext}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: UPLOAD_MAX_BYTES,
    },
  });
};

export const prepareUploadStorage = async () => {
  if (!isVercel) {
    await ensureUploadsDir();
  }
};

export const isUploadRuntimeDisabled = () => isVercel || env.isVercel;
