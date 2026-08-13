import crypto from "node:crypto";
import path from "node:path";

import multer from "multer";

import { env } from "../config/env";
import { ensureUploadsDir, UPLOAD_MAX_BYTES, UPLOADS_DIR } from "../config/upload";
import { getMediaExtension, PRODUCT_MEDIA_ALLOWED_MIME_TYPES } from "../services/r2";

const isVercel = Boolean(process.env.VERCEL);

export const createUploadMiddleware = () => {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = getMediaExtension(file.mimetype);
      const name = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-z0-9_-]+/gi, "-") || "upload";
      const unique = crypto.randomUUID();
      cb(null, `${name}-${unique}${ext}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: UPLOAD_MAX_BYTES,
    },
    fileFilter: (_req, file, callback) => {
      if (!PRODUCT_MEDIA_ALLOWED_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
        callback(new Error("Unsupported file type"));
        return;
      }
      callback(null, true);
    },
  });
};

export const prepareUploadStorage = async () => {
  if (!isVercel) {
    await ensureUploadsDir();
  }
};

export const isUploadRuntimeDisabled = () => isVercel || env.isVercel;
