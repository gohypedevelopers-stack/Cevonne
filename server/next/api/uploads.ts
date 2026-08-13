import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { env } from "@/server/config/env";
import { COLLECTION_VIDEO_MAX_BYTES, UPLOAD_MAX_BYTES, UPLOADS_DIR, ensureUploadsDir } from "@/server/config/upload";
import { deleteFileFromR2, hasR2Storage, inferMediaKind, uploadFileToR2 } from "@/server/services/r2";
import { getAuthUser, jsonResponse, methodNotAllowed } from "../route-utils";

const uploadsDisabledResponse = () =>
  jsonResponse(
    {
      message:
        "File uploads are not supported on Vercel because the function filesystem is ephemeral. Use object storage such as S3, Cloudinary, or R2.",
    },
    501
  );

const fileDeleteDisabledResponse = () =>
  jsonResponse(
    {
      message:
        "File deletion is not supported on Vercel because uploaded files are not stored on a persistent filesystem.",
    },
    501
  );

const unauthorizedResponse = () => jsonResponse({ message: "Unauthorized" }, 401);
const forbiddenResponse = () => jsonResponse({ message: "Forbidden" }, 403);

const requireAdmin = async (request: Request) => {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== "ADMIN") return forbiddenResponse();
  return null;
};

const isUploadRuntimeDisabled = () => !hasR2Storage() && (env.isVercel || Boolean(process.env.VERCEL));

const createUploadFilename = (originalName: string) => {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  return `${name}-${crypto.randomUUID()}${ext}`;
};

export const dispatchUploadsRoute = async (request: Request, segments: string[] = []) => {
  const [filename] = segments;
  const useR2 = hasR2Storage();

  const authFailure = await requireAdmin(request);
  if (authFailure) return authFailure;

  if (isUploadRuntimeDisabled()) {
    if (request.method === "POST") {
      return uploadsDisabledResponse();
    }

    if (request.method === "DELETE") {
      return fileDeleteDisabledResponse();
    }
  }

  if (!filename) {
    if (request.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }

    const formData = await request.formData();
    const rawFile = formData.get("image") || formData.get("file");

    if (!(rawFile instanceof File)) {
      return jsonResponse({ message: "No file uploaded" }, 400);
    }

    const kind = String(formData.get("kind") || inferMediaKind(rawFile)).toUpperCase();
    const maxBytes = kind === "VIDEO" ? COLLECTION_VIDEO_MAX_BYTES : UPLOAD_MAX_BYTES;

    if (rawFile.size > maxBytes) {
      return jsonResponse({ message: "File too large" }, 413);
    }

    if (useR2) {
      const folder = String(formData.get("folder") || "").trim().toLowerCase();
      const asset = await uploadFileToR2(rawFile, folder === "collections" ? { folder: "collections" } : {});
      return jsonResponse(
        {
          url: asset.url,
          storageKey: asset.storageKey,
          filename: asset.storageKey,
          originalName: asset.originalName,
          size: asset.size,
          mimeType: asset.mimeType,
          kind: asset.kind,
        },
        201
      );
    }

    await ensureUploadsDir();

    const safeName = createUploadFilename(rawFile.name || "upload");
    const filePath = path.join(UPLOADS_DIR, safeName);
    const bytes = Buffer.from(await rawFile.arrayBuffer());
    await fs.writeFile(filePath, bytes);

    return jsonResponse(
      {
        url: `/uploads/${safeName}`,
        storageKey: safeName,
        filename: safeName,
        originalName: rawFile.name,
        size: rawFile.size,
        mimeType: rawFile.type,
        kind,
      },
      201
    );
  }

  if (request.method !== "DELETE") {
    return methodNotAllowed(["DELETE"]);
  }

  if (useR2) {
    const storageKey = decodeURIComponent(filename).replace(/^\/+/, "");
    const hasUnsafePath =
      !storageKey ||
      storageKey.includes("\\") ||
      storageKey.split("/").some((segment) => !segment || segment === "." || segment === "..");

    if (hasUnsafePath) {
      return jsonResponse({ message: "Invalid storage key" }, 400);
    }

    await deleteFileFromR2(storageKey);
    return new Response(null, { status: 204 });
  }

  const safeFilename = path.basename(decodeURIComponent(filename));

  const filePath = path.join(UPLOADS_DIR, safeFilename);

  try {
    await fs.access(filePath);
  } catch {
    return jsonResponse({ message: "File not found" }, 404);
  }

  await fs.unlink(filePath);
  return new Response(null, { status: 204 });
};
