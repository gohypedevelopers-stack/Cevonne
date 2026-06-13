import crypto from "node:crypto";
import path from "node:path";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/server/config/env";

export type R2MediaKind = "IMAGE" | "VIDEO";
export type R2UploadKind = R2MediaKind;

export type R2UploadRequest = {
  filename: string;
  contentType: string;
  size: number;
  productId?: string | null;
};

export type R2UploadResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  contentType: string;
  kind: R2UploadKind;
  size: number;
};

type StoredAsset = {
  storageKey: string;
  url: string;
  kind: R2MediaKind;
  mimeType: string;
  originalName: string;
  size: number;
};

export const PRODUCT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export const PRODUCT_MEDIA_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
  "video/ogg": ".ogv",
};

const sanitizeFilename = (fileName: string) => {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "upload";
};

const getMediaKind = (mimeType: string): R2MediaKind =>
  mimeType.toLowerCase().startsWith("video/") ? "VIDEO" : "IMAGE";

const createTimestampPrefix = () =>
  new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

let client: S3Client | null = null;

export const hasR2Storage = () =>
  Boolean(
    env.r2AccountId &&
      env.r2AccessKeyId &&
      env.r2SecretAccessKey &&
      env.r2BucketName &&
      env.r2PublicUrl
  );

const getClient = () => {
  if (!hasR2Storage()) {
    throw new Error("R2 storage is not configured");
  }

  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  return client;
};

const encodeKeyPath = (value: string) => value.split("/").map(encodeURIComponent).join("/");

const getExtension = (fileName: string, mimeType: string) => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext) return ext;
  return MIME_EXTENSION_MAP[mimeType.toLowerCase()] || "";
};

export const createProductMediaStorageKey = (
  fileName: string,
  mimeType: string,
  productId?: string | null
) => {
  const safeName = sanitizeFilename(path.basename(fileName || "upload"));
  const extension = getExtension(safeName, mimeType);
  const baseName = extension && safeName.toLowerCase().endsWith(extension) ? safeName : `${safeName}${extension}`;
  const uniquePrefix = `${createTimestampPrefix()}-${crypto.randomUUID().slice(0, 8)}`;
  const parentPath = productId?.trim() ? `products/${sanitizeFilename(productId.trim())}` : "products/tmp";
  return `${parentPath}/${uniquePrefix}-${baseName}`;
};

export const inferMediaKind = (file: File | { type?: string | null }) =>
  String(file.type || "").toLowerCase().startsWith("video/") ? "VIDEO" : "IMAGE";

export const buildR2Url = (storageKey: string) => {
  if (!env.r2PublicUrl) {
    return storageKey;
  }

  const base = env.r2PublicUrl.replace(/\/+$/, "");
  return `${base}/${encodeKeyPath(storageKey)}`;
};

export const createR2StorageKey = (fileName: string, mimeType: string, kind: R2MediaKind) => {
  const ext = getExtension(fileName, mimeType);
  const prefix = kind === "VIDEO" ? "collection-video" : "collection-image";
  return `${prefix}-${crypto.randomUUID()}${ext}`;
};

export const uploadFileToR2 = async (file: File): Promise<StoredAsset> => {
  if (!hasR2Storage()) {
    throw new Error("R2 storage is not configured");
  }

  const kind = inferMediaKind(file);
  const mimeType = file.type || (kind === "VIDEO" ? "video/mp4" : "application/octet-stream");
  const storageKey = createR2StorageKey(file.name || "upload", mimeType, kind);
  const bytes = Buffer.from(await file.arrayBuffer());

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.r2BucketName,
      Key: storageKey,
      Body: bytes,
      ContentType: mimeType,
    })
  );

  return {
    storageKey,
    url: buildR2Url(storageKey),
    kind,
    mimeType,
    originalName: file.name || storageKey,
    size: file.size,
  };
};

export const createR2PresignedUpload = async ({
  filename,
  contentType,
  size,
  productId,
}: R2UploadRequest): Promise<R2UploadResponse> => {
  if (!hasR2Storage()) {
    throw new Error("R2 storage is not configured");
  }

  const normalizedContentType = String(contentType || "").toLowerCase();

  if (!PRODUCT_MEDIA_ALLOWED_MIME_TYPES.has(normalizedContentType)) {
    throw new Error("Unsupported file type");
  }

  if (!Number.isFinite(size) || size <= 0 || size > PRODUCT_MEDIA_MAX_BYTES) {
    throw new Error("File too large");
  }

  const key = createProductMediaStorageKey(filename || "upload", normalizedContentType, productId);
  const kind = getMediaKind(normalizedContentType);
  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: env.r2BucketName,
      Key: key,
      ContentType: normalizedContentType,
    }),
    { expiresIn: 60 * 15 }
  );

  return {
    uploadUrl,
    key,
    publicUrl: buildR2Url(key),
    contentType: normalizedContentType,
    kind,
    size,
  };
};

export const deleteFileFromR2 = async (storageKey: string) => {
  if (!hasR2Storage() || !storageKey) {
    return false;
  }

  await getClient().send(
    new DeleteObjectCommand({
      Bucket: env.r2BucketName,
      Key: storageKey,
    })
  );

  return true;
};
