import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { env } from "@/server/config/env";
import { UPLOAD_MAX_BYTES, UPLOADS_DIR, ensureUploadsDir } from "@/server/config/upload";
import { jsonResponse, methodNotAllowed } from "../route-utils";

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

const isUploadRuntimeDisabled = () => env.isVercel || Boolean(process.env.VERCEL);

const createUploadFilename = (originalName: string) => {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  return `${name}-${crypto.randomUUID()}${ext}`;
};

export const dispatchUploadsRoute = async (request: Request, segments: string[] = []) => {
  const [filename] = segments;

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
    const rawFile = formData.get("image");

    if (!(rawFile instanceof File)) {
      return jsonResponse({ message: "No file uploaded" }, 400);
    }

    if (rawFile.size > UPLOAD_MAX_BYTES) {
      return jsonResponse({ message: "File too large" }, 413);
    }

    await ensureUploadsDir();

    const safeName = createUploadFilename(rawFile.name || "upload");
    const filePath = path.join(UPLOADS_DIR, safeName);
    const bytes = Buffer.from(await rawFile.arrayBuffer());
    await fs.writeFile(filePath, bytes);

    return jsonResponse(
      {
        url: `/uploads/${safeName}`,
        filename: safeName,
        originalName: rawFile.name,
        size: rawFile.size,
      },
      201
    );
  }

  if (request.method !== "DELETE") {
    return methodNotAllowed(["DELETE"]);
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
