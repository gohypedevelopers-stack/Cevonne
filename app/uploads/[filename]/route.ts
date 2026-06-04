export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs/promises";
import path from "node:path";

import { UPLOADS_DIR, ensureUploadsDir } from "@/server/config/upload";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".glb": "model/gltf-binary",
  ".usdz": "model/vnd.usdz+zip",
};

const getContentType = (filename: string) => {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
};

export async function GET(
  _request: Request,
  context: { params?: Promise<{ filename?: string }> }
) {
  const resolved = await Promise.resolve(context?.params);
  const filename = resolved?.filename ? path.basename(decodeURIComponent(resolved.filename)) : "";

  if (!filename) {
    return new Response(JSON.stringify({ message: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  await ensureUploadsDir();

  const filePath = path.join(UPLOADS_DIR, filename);

  try {
    const data = await fs.readFile(filePath);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": getContentType(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(JSON.stringify({ message: "File not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
