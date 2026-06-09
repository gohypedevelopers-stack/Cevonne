import crypto from "node:crypto";
import path from "node:path";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "@/server/config/env";

export type R2MediaKind = "IMAGE" | "VIDEO";

type StoredAsset = {
  storageKey: string;
  url: string;
  kind: R2MediaKind;
  mimeType: string;
  originalName: string;
  size: number;
};

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
